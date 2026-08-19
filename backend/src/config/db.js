const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");
const { attachPoolErrorHandler } = require("./poolErrors");
const logger = require("../utils/logger");

const requestContext = new AsyncLocalStorage();

const poolMax = Number(process.env.DB_POOL_MAX || 10);
// Opening a connection costs a full TLS handshake (~1.2s to a remote region),
// so idle connections are kept long enough to survive gaps between page loads.
const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS || 300000);
const connectionTimeoutMillis = Number(
  process.env.DB_CONNECTION_TIMEOUT_MS || 5000
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  idleTimeoutMillis:
    Number.isFinite(idleTimeoutMillis) && idleTimeoutMillis > 0
      ? idleTimeoutMillis
      : 300000,
  keepAlive: true,
  connectionTimeoutMillis:
    Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis > 0
      ? connectionTimeoutMillis
      : 5000,
  ssl:
    process.env.NODE_ENV === "production" ||
    (process.env.DATABASE_URL || "").includes("supabase")
      ? { rejectUnauthorized: false }
      : false,
});

attachPoolErrorHandler(pool);

function runWithDbContext(context, callback) {
  return requestContext.run(context, callback);
}

async function query(text, params) {
  const start = Date.now();
  const context = requestContext.getStore();
  const client = context ? await pool.connect() : null;

  try {
    let result;

    if (client) {
      // The database is a network round trip away, so every extra statement is
      // paid in latency. Set all three RLS settings in one statement instead of
      // three; they stay transaction-local, which is what the pooler requires.
      await client.query("BEGIN");
      await client.query(
        `SELECT set_config('educlub.user_id', $1, true),
                set_config('educlub.role', $2, true),
                set_config('educlub.school_id', $3, true)`,
        [
          String(context.userId || ""),
          context.role || "",
          context.schoolId ? String(context.schoolId) : "",
        ],
      );
      result = await client.query(text, params);
      await client.query("COMMIT");
    } else {
      result = await pool.query(text, params);
    }

    const duration = Date.now() - start;
    const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 500);
    if (duration >= slowQueryMs) {
      logger.warn("slow_database_query", {
        durationMs: duration,
        rows: result.rowCount,
        statement: String(text).replace(/\s+/g, " ").trim().slice(0, 240),
      });
    } else if (process.env.DB_QUERY_LOGS === "true") {
      logger.debug("database_query", { durationMs: duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        logger.error("database_rollback_failed", { message: rollbackError.message });
      }
    }
    logger.error("database_query_failed", { code: error.code, message: error.message });
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function getClient() {
  const client = await pool.connect();
  return client;
}

async function testConnection() {
  try {
    await query("SELECT 1");
    logger.info("database_connection_successful");
    return true;
  } catch (error) {
    logger.error("database_connection_failed", { code: error.code, message: error.message });
    return false;
  }
}

module.exports = {
  query,
  getClient,
  pool,
  testConnection,
  runWithDbContext,
};
