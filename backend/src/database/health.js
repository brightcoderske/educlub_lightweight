require("dotenv").config();
const { pool } = require("../config/db");
const { migrationStatus } = require("./migrationRunner");

async function getDatabaseHealth(options = {}) {
  const startedAt = Date.now();
  const client = await pool.connect();
  try {
    // A pg client executes one query at a time. Keep diagnostics sequential so
    // this remains compatible with pg 9 and never interleaves protocol messages.
    const version = await client.query("SHOW server_version");
    const migrations = await migrationStatus(client);
    const health = {
      status: migrations.some((item) => item.status === "pending" || !item.checksumValid) ? "degraded" : "ok",
      latencyMs: Date.now() - startedAt,
      postgresVersion: version.rows[0].server_version,
      migrations,
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    };
    if (options.includeDiagnostics) {
      const longRunning = await client.query(`SELECT COUNT(*)::integer AS count FROM pg_stat_activity
          WHERE datname = current_database() AND state <> 'idle' AND pid <> pg_backend_pid()
            AND query_start < NOW() - INTERVAL '5 seconds'`);
      const tableSizes = await client.query(`SELECT relname AS table_name, pg_total_relation_size(relid)::bigint AS total_bytes
          FROM pg_catalog.pg_statio_user_tables ORDER BY total_bytes DESC LIMIT 10`);
      const indexUsage = await client.query(`SELECT relname AS table_name, seq_scan::bigint, idx_scan::bigint,
          n_live_tup::bigint AS estimated_rows FROM pg_stat_user_tables
          ORDER BY seq_scan DESC LIMIT 10`);
      const extensions = await client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname");
      health.diagnostics = {
        longRunningQueries: longRunning.rows[0].count,
        largestTables: tableSizes.rows,
        tableScanStats: indexUsage.rows,
        extensions: extensions.rows,
      };
    }
    return health;
  } finally {
    client.release();
  }
}

if (require.main === module) getDatabaseHealth({ includeDiagnostics: true })
  .then((health) => { console.log(JSON.stringify(health, null, 2)); if (health.status !== "ok") process.exitCode = 1; })
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());

module.exports = { getDatabaseHealth };
