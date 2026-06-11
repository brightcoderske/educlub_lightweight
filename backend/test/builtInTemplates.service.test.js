const test = require("node:test");
const assert = require("node:assert/strict");
const { importBuiltInTemplates } = require("../src/services/builtInTemplates.service");

test("imports built-in templates through one checked-out database client", async () => {
  let released = false;
  let moduleId = 10;
  const client = {
    query: async (sql) => {
      if (sql.includes("SELECT id FROM course_templates")) return { rows: [] };
      if (sql.includes("INSERT INTO course_templates")) return { rows: [{ id: 7 }] };
      if (sql.includes("INSERT INTO course_template_modules")) return { rows: [{ id: moduleId++ }] };
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  const result = await importBuiltInTemplates({ connect: async () => client });
  assert.equal(result.activities, 80);
  assert.equal(released, true);
});

test("startup preserves an existing editable master template", async () => {
  let writeCalled = false;
  const client = {
    query: async (sql) => {
      if (sql.includes("SELECT id FROM course_templates")) return { rows: [{ id: 42 }] };
      writeCalled = true;
      return { rows: [] };
    },
    release: () => {},
  };
  const result = await importBuiltInTemplates({ connect: async () => client });
  assert.deepEqual(result, {
    template_id: 42,
    modules: 0,
    activities: 0,
    skipped: true,
  });
  assert.equal(writeCalled, false);
});
