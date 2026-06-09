const db = require('./db');
const env = require('./env');

module.exports = {
  db,
  query: db.query,
  getClient: db.getClient,
  pool: db.pool,
  testConnection: db.testConnection,
  runWithDbContext: db.runWithDbContext,
  env,
};
