require("dotenv").config();
const { query, pool } = require("../config/db");

// Tables the application cannot run without. Their absence is the failure a
// readiness probe exists to catch.
const REQUIRED_TABLES = ["users", "schools", "learners", "courses", "user_sessions"];

function poolStats() {
  // mysql2 does not publish counters the way node-postgres did, so these are
  // read defensively - a health check must never be the thing that throws.
  const all = pool.pool?._allConnections?.length ?? null;
  const free = pool.pool?._freeConnections?.length ?? null;
  const queued = pool.pool?._connectionQueue?.length ?? null;
  return { total: all, idle: free, waiting: queued };
}

async function getDatabaseHealth(options = {}) {
  const startedAt = Date.now();

  const version = await query("SELECT VERSION() AS version");
  const tables = await query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ANY($1)`,
    [REQUIRED_TABLES],
  );

  const present = new Set(tables.rows.map((row) => String(row.TABLE_NAME).toLowerCase()));
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table));

  const health = {
    status: missing.length ? "degraded" : "ok",
    latencyMs: Date.now() - startedAt,
    mysqlVersion: version.rows[0].version,
    schema: { required: REQUIRED_TABLES.length, present: present.size, missing },
    pool: poolStats(),
  };

  if (options.includeDiagnostics) {
    // information_schema.PROCESSLIST is the MySQL counterpart of
    // pg_stat_activity; TIME is seconds the current command has been running.
    const longRunning = await query(
      `SELECT COUNT(*) AS count FROM information_schema.PROCESSLIST
       WHERE DB = DATABASE() AND COMMAND <> 'Sleep' AND TIME > 5 AND ID <> CONNECTION_ID()`,
    );
    const tableSizes = await query(
      `SELECT TABLE_NAME AS table_name,
              (DATA_LENGTH + INDEX_LENGTH) AS total_bytes,
              TABLE_ROWS AS estimated_rows
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY total_bytes DESC
       LIMIT 10`,
    );

    health.diagnostics = {
      longRunningQueries: Number(longRunning.rows[0]?.count || 0),
      largestTables: tableSizes.rows,
    };
  }

  return health;
}

if (require.main === module) {
  getDatabaseHealth({ includeDiagnostics: true })
    .then((health) => {
      console.log(JSON.stringify(health, null, 2));
      if (health.status !== "ok") process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { getDatabaseHealth };
