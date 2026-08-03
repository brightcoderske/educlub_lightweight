const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = {
  sources: [path.join(__dirname, "..", "schema.sql")],
  async up(client) {
    const sql = await fs.readFile(path.join(__dirname, "..", "schema.sql"), "utf8");
    await client.query(sql);
  },
};
