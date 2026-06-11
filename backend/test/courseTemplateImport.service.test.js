const test = require("node:test");
const assert = require("node:assert/strict");
const template = require("../src/courseTemplates/webDevelopment1.template");
const { importTemplateDefinition } = require("../src/services/courseTemplateImport.service");

test("imports one template with eight modules and eighty activities", async () => {
  let nextModuleId = 10;
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes("INSERT INTO course_templates")) return { rows: [{ id: 7 }] };
    if (sql.includes("INSERT INTO course_template_modules")) return { rows: [{ id: nextModuleId++ }] };
    return { rows: [] };
  };
  assert.deepEqual(await importTemplateDefinition(template, query), { template_id: 7, modules: 8, activities: 80 });
  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-1).sql, "COMMIT");
});

test("rolls back if an insert fails", async () => {
  const calls = [];
  const query = async (sql) => {
    calls.push(sql);
    if (sql.includes("INSERT INTO course_templates")) return { rows: [{ id: 7 }] };
    if (sql.includes("INSERT INTO course_template_modules")) throw new Error("database failed");
    return { rows: [] };
  };
  await assert.rejects(() => importTemplateDefinition(template, query), /database failed/);
  assert.equal(calls.at(-1), "ROLLBACK");
});
