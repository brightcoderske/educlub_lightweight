const path = require("node:path");
const { runStartupSchemaMigration } = require("../../services/startupSchema.service");

module.exports = {
  sources: [path.join(__dirname, "..", "..", "services", "startupSchema.service.js")],
  async up(client) {
    await runStartupSchemaMigration(client);
  },
};
