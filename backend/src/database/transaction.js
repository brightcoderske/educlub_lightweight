const { pool } = require("../config/db");

const ISOLATION_LEVELS = new Set([
  "READ COMMITTED",
  "REPEATABLE READ",
  "SERIALIZABLE",
]);

async function withTransaction(callback, options = {}) {
  const client = options.client || (await pool.connect());
  const ownsClient = !options.client;

  try {
    await client.query("BEGIN");
    if (options.isolationLevel) {
      const isolationLevel = String(options.isolationLevel).toUpperCase();
      if (!ISOLATION_LEVELS.has(isolationLevel)) {
        throw new TypeError(`Unsupported transaction isolation level: ${options.isolationLevel}`);
      }
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    }
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}

module.exports = { withTransaction, ISOLATION_LEVELS };
