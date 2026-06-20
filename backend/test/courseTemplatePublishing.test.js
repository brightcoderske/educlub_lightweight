const test = require("node:test");
const assert = require("node:assert/strict");

const configPath = require.resolve("../src/config");

function loadServiceWithQuery(queryImpl) {
  delete require.cache[require.resolve("../src/services/courseTemplates.service")];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { query: queryImpl },
  };
  return require("../src/services/courseTemplates.service");
}

test("new system course templates are drafts until explicitly published", async () => {
  const calls = [];
  const service = loadServiceWithQuery(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ id: 12, is_active: params[11] }] };
  });

  const created = await service.createTemplate({ name: "Draft Scratch", code: "DRAFT" });

  assert.equal(created.is_active, false);
  assert.equal(calls[0].params[8], 0);
  assert.equal(calls[0].params[9], "KES");
  assert.equal(calls[0].params[11], false);
});

test("school staff template lists are limited to published templates", async () => {
  const service = loadServiceWithQuery(async (sql) => {
    assert.match(sql, /COALESCE\(t\.is_active, true\) = true/);
    return { rows: [] };
  });

  await service.listTemplates({}, { role: "school_admin", schoolId: 4 });
});
