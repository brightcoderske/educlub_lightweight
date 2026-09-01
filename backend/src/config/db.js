// config/index.js requires this module before ./env, which is where dotenv is
// normally loaded - so without this the connection settings below would read an
// empty process.env and silently fall back to defaults. dotenv is idempotent.
require("dotenv").config();

const mysql = require("mysql2/promise");
const { AsyncLocalStorage } = require("async_hooks");
const { attachPoolErrorHandler } = require("./poolErrors");
const { translate } = require("./sqlDialect");
const { planReturning } = require("./returningEmulation");
const logger = require("../utils/logger");

const requestContext = new AsyncLocalStorage();

const poolMax = Number(process.env.DB_POOL_MAX || 10);
const connectTimeout = Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000);

// A single DATABASE_URL keeps deployment to one knob, but the URL is parsed
// into discrete fields here rather than handed to the driver: passing it
// through as `uri` silently ignored the port and connected to 3306.
function connectionSettings() {
  const url = process.env.DATABASE_URL;

  if (url && /^mysql:/i.test(url)) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || "root"),
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.replace(/^\//, "") || "educlub",
    };
  }

  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "educlub",
  };
}

const pool = mysql.createPool({
  ...connectionSettings(),
  waitForConnections: true,
  connectionLimit: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  connectTimeout: Number.isFinite(connectTimeout) && connectTimeout > 0 ? connectTimeout : 5000,
  // Keeping this off means a single query string can never carry a second
  // statement, which removes a whole class of injection escalation.
  multipleStatements: false,
  // Not utf8mb4_0900_ai_ci: that collation is MySQL 8 only, and cPanel ships
  // MariaDB, where the connection would be negotiated with an id that means
  // something else. utf8mb4_unicode_ci exists in both and mysql2 knows it.
  charset: process.env.MYSQL_COLLATION || "utf8mb4_unicode_ci",
  timezone: "Z",
  enableKeepAlive: true,
});

attachPoolErrorHandler(pool);

// PIPES_AS_CONCAT is not optional here. PostgreSQL uses || to join strings;
// MySQL treats it as logical OR by default, so a pattern like '%' || ? || '%'
// would evaluate to a boolean and match nothing - wrong results, with no error
// raised. The rest of the mode is MySQL's strict default, kept so bad data
// errors instead of being silently truncated.
const SESSION_SQL_MODE = [
  "PIPES_AS_CONCAT",
  "ONLY_FULL_GROUP_BY",
  "STRICT_TRANS_TABLES",
  "NO_ZERO_IN_DATE",
  "NO_ZERO_DATE",
  "ERROR_FOR_DIVISION_BY_ZERO",
  "NO_ENGINE_SUBSTITUTION",
].join(",");

pool.on("connection", (connection) => {
  connection.query(`SET SESSION sql_mode = '${SESSION_SQL_MODE}'`, (error) => {
    if (error) logger.error("database_sql_mode_failed", { message: error.message });
  });
});

// The application was written against node-postgres, which answers with
// { rows, rowCount }. mysql2 answers with [rows, fields] for reads and a
// ResultSetHeader for writes. Normalising here is what lets all 443 `.rows`
// accessors across the codebase stay exactly as they are.
function shape(result) {
  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }
  return {
    rows: [],
    rowCount: result?.affectedRows ?? 0,
    insertId: result?.insertId ?? null,
  };
}

async function runPlan(connection, plan) {
  if (plan.kind === "insert") {
    const [written] = await connection.query(plan.write.sql, plan.write.params);
    const key = plan.lookup.byLastInsertId ? written.insertId : plan.lookup.value;
    const [rows] = await connection.query(plan.select, [key]);
    return shape(rows);
  }

  // The rows to return are identified first: the update may change the very
  // columns its own WHERE clause matched on, so afterwards they are unfindable.
  const [targets] = await connection.query(plan.before.sql, plan.before.params);
  const keys = targets.map((row) => row[plan.key]);

  await connection.query(plan.write.sql, plan.write.params);
  if (!keys.length) return { rows: [], rowCount: 0 };

  const [rows] = await connection.query(plan.select(keys.length), keys);
  return shape(rows);
}

async function query(text, params = []) {
  const start = Date.now();
  const translated = translate(text, params);
  const plan = planReturning(translated.sql, translated.params);

  let connection = null;
  try {
    let result;

    if (!plan) {
      const [rows] = await pool.query(translated.sql, translated.params);
      result = shape(rows);
    } else {
      // Write and read-back have to be one atomic unit, or a concurrent
      // writer can change the row in between and the caller is handed data
      // that was never what this statement wrote.
      connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        result = await runPlan(connection, plan);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    const duration = Date.now() - start;
    const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 500);
    if (duration >= slowQueryMs) {
      logger.warn("slow_database_query", {
        durationMs: duration,
        rows: result.rowCount,
        statement: String(translated.sql).replace(/\s+/g, " ").trim().slice(0, 240),
      });
    } else if (process.env.DB_QUERY_LOGS === "true") {
      logger.debug("database_query", { durationMs: duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    logger.error("database_query_failed", { code: error.code, message: error.message });
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Presents a mysql2 connection with the surface node-postgres had, so
// withTransaction() and the services that take a client keep working. BEGIN,
// COMMIT and ROLLBACK are all valid MySQL, so they need no special casing.
function wrapConnection(connection) {
  return {
    async query(text, params = []) {
      const translated = translate(text, params);
      const plan = planReturning(translated.sql, translated.params);
      if (plan) return runPlan(connection, plan);
      const [rows] = await connection.query(translated.sql, translated.params);
      return shape(rows);
    },
    release() {
      connection.release();
    },
    get raw() {
      return connection;
    },
  };
}

async function getClient() {
  return wrapConnection(await pool.getConnection());
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

// Row level security is gone with PostgreSQL, so there are no per-request
// settings to push into the session any more. The context is still carried
// because middleware establishes it and logging can use it - and, importantly,
// every query now costs one round trip instead of the four that BEGIN,
// set_config, the statement and COMMIT used to take.
function runWithDbContext(context, callback) {
  return requestContext.run(context, callback);
}

module.exports = {
  query,
  getClient,
  // withTransaction() calls pool.connect(); node-postgres named it that way.
  pool: Object.assign(pool, { connect: getClient }),
  testConnection,
  runWithDbContext,
};
