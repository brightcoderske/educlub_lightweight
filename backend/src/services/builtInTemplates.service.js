const { importTemplateDefinition } = require("./courseTemplateImport.service");

const builtInTemplates = [
  require("../courseTemplates/webDevelopment1.template"),
  require("../courseTemplates/scratchIntermediate.template"),
  require("../courseTemplates/scratchExplorer.template"),
  require("../courseTemplates/scratchCreator.template"),
  require("../courseTemplates/scratchInnovator.template"),
];

async function importBuiltInTemplates(databasePool) {
  const selectedPool = databasePool || require("../config").pool;
  const client = await selectedPool.connect();
  try {
    const result = {
      imported: 0,
      skipped: 0,
      modules: 0,
      activities: 0,
      templates: [],
    };

    for (const definition of builtInTemplates) {
      const existing = await client.query(
        "SELECT id FROM course_templates WHERE code = $1 LIMIT 1",
        [definition.code],
      );
      if (existing.rows[0]) {
        result.skipped += 1;
        result.templates.push({
          code: definition.code,
          template_id: existing.rows[0].id,
          skipped: true,
          modules: 0,
          activities: 0,
        });
        continue;
      }

      const imported = await importTemplateDefinition(
        definition,
        client.query.bind(client),
      );
      result.imported += 1;
      result.modules += imported.modules;
      result.activities += imported.activities;
      result.templates.push({
        code: definition.code,
        ...imported,
        skipped: false,
      });
    }

    return result;
  } finally {
    client.release();
  }
}

module.exports = { importBuiltInTemplates };
