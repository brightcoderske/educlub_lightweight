const { pool } = require("../src/config");
const template = require("../src/courseTemplates/webDevelopment1.template");
const { importTemplateDefinition } = require("../src/services/courseTemplateImport.service");

async function main() {
  const client = await pool.connect();
  try {
    const result = await importTemplateDefinition(template, client.query.bind(client));
    console.log(`Imported Web Development 1: template ${result.template_id}, ${result.modules} modules, ${result.activities} activities.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Web Development 1 import failed:", error);
  process.exitCode = 1;
});
