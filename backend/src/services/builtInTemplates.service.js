const webDevelopment1 = require("../courseTemplates/webDevelopment1.template");
const { importTemplateDefinition } = require("./courseTemplateImport.service");

async function importBuiltInTemplates(databasePool) {
  const selectedPool = databasePool || require("../config").pool;
  const client = await selectedPool.connect();
  try {
    const existing = await client.query(
      "SELECT id FROM course_templates WHERE code = $1 LIMIT 1",
      [webDevelopment1.code],
    );
    if (existing.rows[0]) {
      return {
        template_id: existing.rows[0].id,
        modules: 0,
        activities: 0,
        skipped: true,
      };
    }
    return await importTemplateDefinition(
      webDevelopment1,
      client.query.bind(client),
    );
  } finally {
    client.release();
  }
}

module.exports = { importBuiltInTemplates };
