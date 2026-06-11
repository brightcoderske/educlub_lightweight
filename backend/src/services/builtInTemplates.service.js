const webDevelopment1 = require("../courseTemplates/webDevelopment1.template");
const { importTemplateDefinition } = require("./courseTemplateImport.service");

async function importBuiltInTemplates(databasePool) {
  const selectedPool = databasePool || require("../config").pool;
  const client = await selectedPool.connect();
  try {
    return await importTemplateDefinition(
      webDevelopment1,
      client.query.bind(client),
    );
  } finally {
    client.release();
  }
}

module.exports = { importBuiltInTemplates };
