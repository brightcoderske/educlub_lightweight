const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");
const { attachPoolErrorHandler } = require("./poolErrors");
const logger = require("../utils/logger");

const requestContext = new AsyncLocalStorage();

const poolMax = Number(process.env.DB_POOL_MAX || 4);
const idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT_MS || 10000);
const connectionTimeoutMillis = Number(
  process.env.DB_CONNECTION_TIMEOUT_MS || 5000
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 4,
  idleTimeoutMillis:
    Number.isFinite(idleTimeoutMillis) && idleTimeoutMillis > 0
      ? idleTimeoutMillis
      : 10000,
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
      await client.query("BEGIN");
      await client.query("SELECT set_config('educlub.user_id', $1, true)", [
        String(context.userId || ""),
      ]);
      await client.query("SELECT set_config('educlub.role', $1, true)", [
        context.role || "",
      ]);
      await client.query("SELECT set_config('educlub.school_id', $1, true)", [
        context.schoolId ? String(context.schoolId) : "",
      ]);
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
