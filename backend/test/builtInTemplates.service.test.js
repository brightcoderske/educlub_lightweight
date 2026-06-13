const test = require("node:test");
const assert = require("node:assert/strict");
const { importBuiltInTemplates } = require("../src/services/builtInTemplates.service");

test("skips existing templates and imports missing templates independently", async () => {
  const selectedCodes = [];
  let connectCount = 0;
  let released = false;
  let moduleId = 10;
  const client = {
    query: async (sql, params = []) => {
      if (sql.includes("SELECT id FROM course_templates")) {
        selectedCodes.push(params[0]);
        return params[0] === "WEB-DEV-1"
          ? { rows: [{ id: 42 }] }
          : { rows: [] };
      }
      if (sql.includes("INSERT INTO course_templates")) {
        return { rows: [{ id: 77 }] };
      }
      if (sql.includes("INSERT INTO course_template_modules")) {
        return { rows: [{ id: moduleId++ }] };
      }
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  const result = await importBuiltInTemplates({
    connect: async () => {
      connectCount += 1;
      return client;
    },
  });

  assert.deepEqual(selectedCodes, [
    "WEB-DEV-1",
    "SCRATCH-INTERMEDIATE",
    "SCRATCH-EXPLORER",
    "SCRATCH-CREATOR",
    "SCRATCH-INNOVATOR",
  ]);
  assert.equal(connectCount, 1);
  assert.equal(released, true);
  assert.deepEqual(result, {
    imported: 4,
    skipped: 1,
    modules: 40,
    activities: 350,
    templates: [
      {
        code: "WEB-DEV-1",
        template_id: 42,
        skipped: true,
        modules: 0,
        activities: 0,
      },
      {
        code: "SCRATCH-INTERMEDIATE",
        template_id: 77,
        skipped: false,
        modules: 10,
        activities: 80,
      },
      {
        code: "SCRATCH-EXPLORER",
        template_id: 77,
        skipped: false,
        modules: 10,
        activities: 90,
      },
      {
        code: "SCRATCH-CREATOR",
        template_id: 77,
        skipped: false,
        modules: 10,
        activities: 90,
      },
      {
        code: "SCRATCH-INNOVATOR",
        template_id: 77,
        skipped: false,
        modules: 10,
        activities: 90,
      },
    ],
  });
});

test("imports all missing built-in templates through one checked-out client", async () => {
  let connectCount = 0;
  let released = false;
  let templateId = 70;
  let moduleId = 10;
  const client = {
    query: async (sql) => {
      if (sql.includes("SELECT id FROM course_templates")) return { rows: [] };
      if (sql.includes("INSERT INTO course_templates")) {
        return { rows: [{ id: templateId++ }] };
      }
      if (sql.includes("INSERT INTO course_template_modules")) {
        return { rows: [{ id: moduleId++ }] };
      }
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  const result = await importBuiltInTemplates({
    connect: async () => {
      connectCount += 1;
      return client;
    },
  });

  assert.equal(connectCount, 1);
  assert.equal(released, true);
  assert.equal(result.imported, 5);
  assert.equal(result.skipped, 0);
  assert.equal(result.modules, 48);
  assert.equal(result.activities, 430);
  assert.equal(result.templates.length, 5);
});
