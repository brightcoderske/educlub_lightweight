require("dotenv").config();
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("../config/db");

const migrationsDirectory = path.join(__dirname, "migrations");

// Checksums must stay stable across platforms. Windows checkouts convert these
// files to CRLF, so hash line-ending-normalised bytes and keep the digest equal
// to the LF value already recorded in schema_migrations.
async function readNormalised(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return Buffer.from(contents.replace(/\r\n/g, "\n"), "utf8");
}

async function checksumMigration(filePath, migration) {
  const hash = crypto.createHash("sha256");
  hash.update(await readNormalised(filePath));
  for (const source of migration.sources || []) hash.update(await readNormalised(source));
  return hash.digest("hex");
}

async function loadMigrations() {
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => /^\d[\w.-]*\.js$/.test(file))
    .sort((left, right) => left.localeCompare(right));
  const seen = new Set();
  return Promise.all(files.map(async (file) => {
    const version = file.replace(/\.js$/, "");
    if (seen.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    seen.add(version);
    const filePath = path.join(migrationsDirectory, file);
    delete require.cache[require.resolve(filePath)];
    const migration = require(filePath);
    if (typeof migration.up !== "function") throw new Error(`Migration ${version} has no up function`);
    return { version, migration, checksum: await checksumMigration(filePath, migration) };
  }));
}

async function ensureHistory(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(150) PRIMARY KEY,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function migrationStatus(client) {
  const migrations = await loadMigrations();
  const historyExists = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
  if (!historyExists.rows[0]?.table_name) {
    return migrations.map((entry) => ({ version: entry.version, status: "pending", checksumValid: true, appliedAt: null }));
  }
  const applied = await client.query("SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version");
  const byVersion = new Map(applied.rows.map((row) => [row.version, row]));
  return migrations.map((entry) => ({
    version: entry.version,
    status: byVersion.has(entry.version) ? "applied" : "pending",
    checksumValid: !byVersion.has(entry.version) || byVersion.get(entry.version).checksum === entry.checksum,
    appliedAt: byVersion.get(entry.version)?.applied_at || null,
  }));
}

async function migrate(client) {
  await ensureHistory(client);
  const migrations = await loadMigrations();
  const applied = await client.query("SELECT version, checksum FROM schema_migrations");
  const byVersion = new Map(applied.rows.map((row) => [row.version, row.checksum]));
  for (const entry of migrations) {
    if (byVersion.has(entry.version)) {
      if (byVersion.get(entry.version) !== entry.checksum) throw new Error(`Applied migration ${entry.version} was modified`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await entry.migration.up(client);
      await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [entry.version, entry.checksum]);
      await client.query("COMMIT");
      process.stdout.write(`Applied ${entry.version}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${entry.version} failed: ${error.message}`, { cause: error });
    }
  }
}

async function main() {
  const client = await pool.connect();
  try {
    if (process.argv.includes("--status")) console.table(await migrationStatus(client));
    else await migrate(client);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { loadMigrations, migrate, migrationStatus };
