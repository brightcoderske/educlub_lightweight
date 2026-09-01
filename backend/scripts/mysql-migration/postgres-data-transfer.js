#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mysql = require("mysql2/promise");
const { Client } = require("pg");

const DUMP_FORMAT = "educlub-postgres-logical-dump-v1";
const SPECIAL_TYPE = "__educlub_postgres_dump_type__";
const IMPORT_EXCLUDED_TABLES = new Set(["schema_migrations"]);

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function quotePostgresIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteMysqlIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function mysqlSettings() {
  const value = process.env.DATABASE_URL;
  if (!value || !/^mysql:/i.test(value)) {
    throw new Error("DATABASE_URL must contain the target MySQL connection URL");
  }

  const parsed = new URL(value);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, "") || "educlub",
    charset: "utf8mb4_0900_ai_ci",
    timezone: "Z",
  };
}

function sourceClient() {
  if (!process.env.POSTGRES_SOURCE_URL || !/^postgres(?:ql)?:/i.test(process.env.POSTGRES_SOURCE_URL)) {
    throw new Error("POSTGRES_SOURCE_URL must contain the source PostgreSQL connection URL");
  }

  return new Client({
    connectionString: process.env.POSTGRES_SOURCE_URL,
    application_name: "educlub-postgres-data-transfer",
    connectionTimeoutMillis: 15000,
    query_timeout: 120000,
  });
}

async function sourceMetadata(client) {
  const result = await client.query(`
    SELECT
      current_database() AS database,
      current_setting('server_version') AS version,
      now() AS server_time
  `);
  return result.rows[0];
}

async function sourceSchema(client) {
  const columns = await client.query(`
    SELECT
      c.table_name,
      c.column_name,
      c.ordinal_position,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
         AND kcu.table_name = tc.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = c.table_schema
          AND tc.table_name = c.table_name
          AND kcu.column_name = c.column_name
      ) AS is_primary_key
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `);

  const tables = new Map();
  for (const column of columns.rows) {
    if (!tables.has(column.table_name)) {
      tables.set(column.table_name, { name: column.table_name, columns: [] });
    }
    tables.get(column.table_name).columns.push({
      name: column.column_name,
      ordinalPosition: Number(column.ordinal_position),
      dataType: column.data_type,
      udtName: column.udt_name,
      nullable: column.is_nullable === "YES",
      default: column.column_default,
      primaryKey: column.is_primary_key,
    });
  }
  return [...tables.values()];
}

async function targetSchema(connection) {
  const [columns] = await connection.query(`
    SELECT
      TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name,
      ORDINAL_POSITION AS ordinal_position,
      DATA_TYPE AS data_type,
      COLUMN_TYPE AS column_type,
      IS_NULLABLE AS is_nullable,
      COLUMN_DEFAULT AS column_default,
      COLUMN_KEY AS column_key,
      EXTRA AS extra
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  const tables = new Map();
  for (const column of columns) {
    if (!tables.has(column.table_name)) {
      tables.set(column.table_name, { name: column.table_name, columns: [] });
    }
    tables.get(column.table_name).columns.push({
      name: column.column_name,
      ordinalPosition: Number(column.ordinal_position),
      dataType: column.data_type,
      columnType: column.column_type,
      nullable: column.is_nullable === "YES",
      default: column.column_default,
      primaryKey: column.column_key === "PRI",
      extra: column.extra || "",
    });
  }
  return tables;
}

async function exactSourceCount(client, tableName) {
  const result = await client.query(
    `SELECT COUNT(*)::bigint AS count FROM public.${quotePostgresIdentifier(tableName)}`,
  );
  return Number(result.rows[0].count);
}

async function exactTargetCount(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count FROM ${quoteMysqlIdentifier(tableName)}`,
  );
  return Number(rows[0].count);
}

function encodeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Buffer.isBuffer(value)) {
    return { [SPECIAL_TYPE]: "buffer", base64: value.toString("base64") };
  }
  if (value instanceof Date) {
    return { [SPECIAL_TYPE]: "date", iso: value.toISOString() };
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { [SPECIAL_TYPE]: "number", value: String(value) };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
  }
  return value;
}

function decodeValue(value) {
  if (!value || typeof value !== "object") return value;
  if (value[SPECIAL_TYPE] === "buffer") return Buffer.from(value.base64, "base64");
  if (value[SPECIAL_TYPE] === "date") return new Date(value.iso);
  if (value[SPECIAL_TYPE] === "number") return Number(value.value);
  if (Array.isArray(value)) return value.map(decodeValue);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]));
}

function tableFileName(tableName) {
  return `${encodeURIComponent(tableName)}.jsonl.gz`;
}

function defaultDumpDirectory() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(__dirname, "../../../backups", `supabase-postgres-${stamp}`);
}

async function audit() {
  const source = sourceClient();
  const target = await mysql.createConnection(mysqlSettings());
  try {
    await source.connect();
    const [metadata, sourceTables, targetTables] = await Promise.all([
      sourceMetadata(source),
      sourceSchema(source),
      targetSchema(target),
    ]);

    const tables = [];
    for (const table of sourceTables) {
      const destination = targetTables.get(table.name);
      const sourceRows = await exactSourceCount(source, table.name);
      const targetRows = destination ? await exactTargetCount(target, table.name) : null;
      const targetColumnNames = new Set((destination?.columns || []).map((column) => column.name));
      const sourceColumnNames = new Set(table.columns.map((column) => column.name));
      tables.push({
        table: table.name,
        sourceRows,
        targetRows,
        existsInMysql: Boolean(destination),
        sourceOnlyColumns: table.columns
          .map((column) => column.name)
          .filter((name) => !targetColumnNames.has(name)),
        mysqlOnlyRequiredColumns: (destination?.columns || [])
          .filter(
            (column) =>
              !sourceColumnNames.has(column.name) &&
              !column.nullable &&
              column.default === null &&
              !/auto_increment|generated/i.test(column.extra),
          )
          .map((column) => column.name),
      });
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          source: metadata,
          sourceTableCount: sourceTables.length,
          targetTableCount: targetTables.size,
          sourceRows: tables.reduce((total, table) => total + table.sourceRows, 0),
          nonEmptyTables: tables.filter((table) => table.sourceRows > 0),
          sourceOnlyTables: tables.filter((table) => !table.existsInMysql).map((table) => table.table),
          incompatibleTables: tables.filter(
            (table) => table.sourceOnlyColumns.length || table.mysqlOnlyRequiredColumns.length,
          ),
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

async function dump() {
  const outputDirectory = path.resolve(argument("output", defaultDumpDirectory()));
  if (fs.existsSync(outputDirectory)) {
    throw new Error(`Dump directory already exists: ${outputDirectory}`);
  }

  fs.mkdirSync(path.join(outputDirectory, "tables"), { recursive: true });
  const source = sourceClient();
  let transactionOpen = false;
  try {
    await source.connect();
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;

    const metadata = await sourceMetadata(source);
    const tables = await sourceSchema(source);
    const manifest = {
      format: DUMP_FORMAT,
      createdAt: new Date().toISOString(),
      source: metadata,
      consistentSnapshot: "repeatable read, read only",
      tables: [],
    };

    for (const table of tables) {
      const primaryKey = table.columns.filter((column) => column.primaryKey).map((column) => column.name);
      const orderBy = primaryKey.length
        ? ` ORDER BY ${primaryKey.map(quotePostgresIdentifier).join(", ")}`
        : "";
      const result = await source.query(
        `SELECT * FROM public.${quotePostgresIdentifier(table.name)}${orderBy}`,
      );
      const contents = result.rows
        .map((row) => JSON.stringify(encodeValue(row)))
        .join("\n");
      const payload = contents ? `${contents}\n` : "";
      const compressed = zlib.gzipSync(Buffer.from(payload, "utf8"), { level: 9 });
      const relativeFile = path.join("tables", tableFileName(table.name));
      fs.writeFileSync(path.join(outputDirectory, relativeFile), compressed, { flag: "wx" });
      manifest.tables.push({
        name: table.name,
        columns: table.columns,
        primaryKey,
        rowCount: result.rows.length,
        file: relativeFile.replace(/\\/g, "/"),
        sha256: crypto.createHash("sha256").update(payload).digest("hex"),
        compressedBytes: compressed.length,
      });
      console.log(`dumped ${table.name}: ${result.rows.length} rows`);
    }

    fs.writeFileSync(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    await source.query("COMMIT");
    transactionOpen = false;
    console.log(
      JSON.stringify(
        {
          status: "ok",
          dumpDirectory: outputDirectory,
          tables: manifest.tables.length,
          rows: manifest.tables.reduce((total, table) => total + table.rowCount, 0),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (transactionOpen) await source.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await source.end().catch(() => {});
  }
}

function readDump(dumpDirectory) {
  const resolved = path.resolve(dumpDirectory);
  const manifestPath = path.join(resolved, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.format !== DUMP_FORMAT) {
    throw new Error(`Unsupported dump format: ${manifest.format || "missing"}`);
  }

  const tableRows = new Map();
  for (const table of manifest.tables) {
    const compressed = fs.readFileSync(path.join(resolved, table.file));
    const payload = zlib.gunzipSync(compressed).toString("utf8");
    const digest = crypto.createHash("sha256").update(payload).digest("hex");
    if (digest !== table.sha256) throw new Error(`Checksum mismatch for ${table.name}`);
    const rows = payload
      .split("\n")
      .filter(Boolean)
      .map((line) => decodeValue(JSON.parse(line)));
    if (rows.length !== table.rowCount) {
      throw new Error(`Row count mismatch in dump for ${table.name}`);
    }
    tableRows.set(table.name, rows);
  }
  return { resolved, manifest, tableRows };
}

function verifyDump() {
  const dumpDirectory = argument("dump");
  if (!dumpDirectory) throw new Error("Verification requires --dump <directory>");
  const dumpData = readDump(dumpDirectory);
  console.log(
    JSON.stringify(
      {
        status: "ok",
        dumpDirectory: dumpData.resolved,
        format: dumpData.manifest.format,
        tables: dumpData.manifest.tables.length,
        rows: dumpData.manifest.tables.reduce((total, table) => total + table.rowCount, 0),
        importExcludedTables: [...IMPORT_EXCLUDED_TABLES],
      },
      null,
      2,
    ),
  );
}

async function verifySource() {
  const dumpDirectory = argument("dump");
  if (!dumpDirectory) throw new Error("Source verification requires --dump <directory>");
  const dumpData = readDump(dumpDirectory);
  const source = sourceClient();
  let transactionOpen = false;
  try {
    await source.connect();
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    const currentTables = await sourceSchema(source);
    const currentTableNames = new Set(currentTables.map((table) => table.name));
    const manifestTableNames = new Set(dumpData.manifest.tables.map((table) => table.name));
    const addedTables = [...currentTableNames].filter((name) => !manifestTableNames.has(name));
    const removedTables = [...manifestTableNames].filter((name) => !currentTableNames.has(name));
    const countMismatches = [];
    const hashMismatches = [];
    let hashVerifiedTables = 0;
    let countOnlyTables = 0;

    for (const table of dumpData.manifest.tables) {
      if (!currentTableNames.has(table.name)) continue;
      const currentCount = await exactSourceCount(source, table.name);
      if (currentCount !== table.rowCount) {
        countMismatches.push({ table: table.name, expected: table.rowCount, actual: currentCount });
        continue;
      }
      if (!table.primaryKey.length) {
        countOnlyTables += 1;
        continue;
      }
      const orderBy = table.primaryKey.map(quotePostgresIdentifier).join(", ");
      const result = await source.query(
        `SELECT * FROM public.${quotePostgresIdentifier(table.name)} ORDER BY ${orderBy}`,
      );
      const contents = result.rows.map((row) => JSON.stringify(encodeValue(row))).join("\n");
      const payload = contents ? `${contents}\n` : "";
      const digest = crypto.createHash("sha256").update(payload).digest("hex");
      hashVerifiedTables += 1;
      if (digest !== table.sha256) hashMismatches.push(table.name);
    }

    await source.query("COMMIT");
    transactionOpen = false;
    const result = {
      status:
        addedTables.length === 0 &&
        removedTables.length === 0 &&
        countMismatches.length === 0 &&
        hashMismatches.length === 0
          ? "ok"
          : "error",
      dumpDirectory: dumpData.resolved,
      verifiedTables: dumpData.manifest.tables.length,
      verifiedRows: dumpData.manifest.tables.reduce((total, table) => total + table.rowCount, 0),
      hashVerifiedTables,
      countOnlyTables,
      addedTables,
      removedTables,
      countMismatches,
      hashMismatches,
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "ok") throw new Error("Source changed after the dump was created");
  } catch (error) {
    if (transactionOpen) await source.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await source.end().catch(() => {});
  }
}

async function verifyTarget() {
  const dumpDirectory = argument("dump");
  if (!dumpDirectory) throw new Error("Target verification requires --dump <directory>");
  const dumpData = readDump(dumpDirectory);
  const importTables = dumpData.manifest.tables.filter(
    (table) => !IMPORT_EXCLUDED_TABLES.has(table.name),
  );
  const target = await mysql.createConnection(mysqlSettings());
  try {
    const targetTables = await targetSchema(target);
    const countMismatches = [];
    for (const table of importTables) {
      if (!targetTables.has(table.name)) {
        countMismatches.push({ table: table.name, expected: table.rowCount, actual: null });
        continue;
      }
      const actual = await exactTargetCount(target, table.name);
      if (actual !== table.rowCount) {
        countMismatches.push({ table: table.name, expected: table.rowCount, actual });
      }
    }

    const [foreignKeyRows] = await target.query(`
      SELECT
        CONSTRAINT_NAME AS constraint_name,
        TABLE_NAME AS table_name,
        COLUMN_NAME AS column_name,
        REFERENCED_TABLE_NAME AS referenced_table_name,
        REFERENCED_COLUMN_NAME AS referenced_column_name,
        ORDINAL_POSITION AS ordinal_position
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
    `);
    const constraints = new Map();
    for (const row of foreignKeyRows) {
      const key = `${row.table_name}.${row.constraint_name}`;
      if (!constraints.has(key)) {
        constraints.set(key, {
          name: row.constraint_name,
          table: row.table_name,
          referencedTable: row.referenced_table_name,
          columns: [],
        });
      }
      constraints.get(key).columns.push({
        child: row.column_name,
        parent: row.referenced_column_name,
      });
    }

    const orphanedForeignKeys = [];
    for (const constraint of constraints.values()) {
      const join = constraint.columns
        .map(
          (column) =>
            `p.${quoteMysqlIdentifier(column.parent)} = c.${quoteMysqlIdentifier(column.child)}`,
        )
        .join(" AND ");
      const populated = constraint.columns
        .map((column) => `c.${quoteMysqlIdentifier(column.child)} IS NOT NULL`)
        .join(" AND ");
      const [rows] = await target.query(`
        SELECT COUNT(*) AS count
        FROM ${quoteMysqlIdentifier(constraint.table)} c
        LEFT JOIN ${quoteMysqlIdentifier(constraint.referencedTable)} p ON ${join}
        WHERE ${populated}
          AND p.${quoteMysqlIdentifier(constraint.columns[0].parent)} IS NULL
      `);
      const count = Number(rows[0].count);
      if (count) {
        orphanedForeignKeys.push({
          table: constraint.table,
          constraint: constraint.name,
          referencedTable: constraint.referencedTable,
          rows: count,
        });
      }
    }

    const [foreignKeySettingRows] = await target.query(
      "SELECT @@SESSION.FOREIGN_KEY_CHECKS AS foreign_key_checks",
    );
    const foreignKeyChecks = Number(foreignKeySettingRows[0].foreign_key_checks);
    const result = {
      status:
        countMismatches.length === 0 && orphanedForeignKeys.length === 0 && foreignKeyChecks === 1
          ? "ok"
          : "error",
      dumpDirectory: dumpData.resolved,
      verifiedTables: importTables.length,
      verifiedRows: importTables.reduce((total, table) => total + table.rowCount, 0),
      verifiedForeignKeys: constraints.size,
      foreignKeyChecks,
      countMismatches,
      orphanedForeignKeys,
      excludedTables: [...IMPORT_EXCLUDED_TABLES],
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "ok") throw new Error("Target verification failed");
  } finally {
    await target.end().catch(() => {});
  }
}

function mysqlValue(value, column) {
  if (value === null || value === undefined) return null;
  if (column.dataType === "json") return JSON.stringify(value);
  if (/^(tinyint|boolean|bool)$/i.test(column.dataType) && typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (Array.isArray(value) || (typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  return value;
}

async function importDump() {
  if (!flag("replace")) {
    throw new Error("Import requires --replace because existing rows in matching MySQL tables will be replaced");
  }
  const dumpDirectory = argument("dump");
  if (!dumpDirectory) throw new Error("Import requires --dump <directory>");

  const dumpData = readDump(dumpDirectory);
  const importTables = dumpData.manifest.tables.filter(
    (table) => !IMPORT_EXCLUDED_TABLES.has(table.name),
  );
  const target = await mysql.createConnection(mysqlSettings());
  let transactionOpen = false;
  let foreignKeysDisabled = false;
  try {
    const targetTables = await targetSchema(target);
    const missingTables = importTables
      .filter((table) => !targetTables.has(table.name))
      .map((table) => table.name);
    if (missingTables.length) {
      throw new Error(`MySQL is missing source tables: ${missingTables.join(", ")}`);
    }

    const incompatible = [];
    for (const table of importTables) {
      const sourceColumns = new Set(table.columns.map((column) => column.name));
      const targetTable = targetTables.get(table.name);
      const sourceOnlyColumns = table.columns
        .map((column) => column.name)
        .filter((name) => !targetTable.columns.some((column) => column.name === name));
      const missingRequiredColumns = targetTable.columns
        .filter(
          (column) =>
            !sourceColumns.has(column.name) &&
            !column.nullable &&
            column.default === null &&
            !/auto_increment|generated/i.test(column.extra),
        )
        .map((column) => column.name);
      if (sourceOnlyColumns.length || missingRequiredColumns.length) {
        incompatible.push({ table: table.name, sourceOnlyColumns, missingRequiredColumns });
      }
    }
    if (incompatible.length) {
      throw new Error(`Schema incompatibilities prevent import: ${JSON.stringify(incompatible)}`);
    }

    await target.beginTransaction();
    transactionOpen = true;
    await target.query("SET FOREIGN_KEY_CHECKS = 0");
    foreignKeysDisabled = true;

    for (const table of importTables) {
      const targetTable = targetTables.get(table.name);
      const sourceColumnNames = new Set(table.columns.map((column) => column.name));
      const columns = targetTable.columns.filter(
        (column) => sourceColumnNames.has(column.name) && !/generated/i.test(column.extra),
      );
      const rows = dumpData.tableRows.get(table.name);

      await target.query(`DELETE FROM ${quoteMysqlIdentifier(table.name)}`);
      for (let offset = 0; offset < rows.length; offset += 200) {
        const batch = rows.slice(offset, offset + 200);
        const placeholders = batch
          .map(() => `(${columns.map(() => "?").join(", ")})`)
          .join(", ");
        const values = batch.flatMap((row) =>
          columns.map((column) => mysqlValue(row[column.name], column)),
        );
        await target.query(
          `INSERT INTO ${quoteMysqlIdentifier(table.name)} (${columns
            .map((column) => quoteMysqlIdentifier(column.name))
            .join(", ")}) VALUES ${placeholders}`,
          values,
        );
      }
      const importedRows = await exactTargetCount(target, table.name);
      if (importedRows !== table.rowCount) {
        throw new Error(
          `Imported row count mismatch for ${table.name}: expected ${table.rowCount}, found ${importedRows}`,
        );
      }
      console.log(`imported ${table.name}: ${importedRows} rows`);
    }

    await target.commit();
    transactionOpen = false;
    await target.query("SET FOREIGN_KEY_CHECKS = 1");
    foreignKeysDisabled = false;
    console.log(
      JSON.stringify(
        {
          status: "ok",
          dumpDirectory: dumpData.resolved,
          tables: importTables.length,
          rows: importTables.reduce((total, table) => total + table.rowCount, 0),
          excludedTables: [...IMPORT_EXCLUDED_TABLES],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (transactionOpen) await target.rollback().catch(() => {});
    if (foreignKeysDisabled) await target.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    throw error;
  } finally {
    await target.end().catch(() => {});
  }
}

async function main() {
  const mode = process.argv[2] || "audit";
  if (mode === "audit") return audit();
  if (mode === "dump") return dump();
  if (mode === "verify") return verifyDump();
  if (mode === "verify-source") return verifySource();
  if (mode === "verify-target") return verifyTarget();
  if (mode === "import") return importDump();
  throw new Error(
    `Unknown mode: ${mode}. Use audit, dump, verify, verify-source, verify-target, or import.`,
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "error", message: error.message, code: error.code || null }, null, 2));
  process.exitCode = 1;
});
