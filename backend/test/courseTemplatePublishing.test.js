const test = require("node:test");
const assert = require("node:assert/strict");

const configPath = require.resolve("../src/config");
const transactionPath = require.resolve("../src/database/transaction");

function loadServiceWithQuery(queryImpl) {
  delete require.cache[require.resolve("../src/services/courseTemplates.service")];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { query: queryImpl },
  };
  require.cache[transactionPath] = {
    id: transactionPath,
    filename: transactionPath,
    loaded: true,
    exports: {
      withTransaction: (callback) => callback({ query: queryImpl }),
    },
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
    assert.match(sql, /t\.deleted_at IS NULL/);
    return { rows: [] };
  });

  await service.listTemplates({}, { role: "school_admin", schoolId: 4 });
});

test("system admins archive templates without deleting adopted school courses", async () => {
  const calls = [];
  const service = loadServiceWithQuery(async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [], rowCount: 1 };
  });

  assert.equal(await service.deleteTemplate(12), true);
  assert.match(calls[0].sql, /UPDATE course_templates/);
  assert.match(calls[0].sql, /deleted_at = CURRENT_TIMESTAMP/);
  assert.ok(!calls[0].sql.includes("DELETE FROM"));
  assert.deepEqual(calls[0].params, [12]);
});

test("editing a visible field preserves template metadata omitted by the compact form", async () => {
  const calls = [];
  const service = loadServiceWithQuery(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT * FROM course_templates")) {
      return {
        rows: [
          {
            id: 12,
            name: "Scratch",
            image_url: "/cover.webp",
            learning_objectives: ["Build a game"],
            certificate_enabled: true,
            course_category: "general",
            is_active: true,
          },
        ],
      };
    }
    if (sql.startsWith("UPDATE course_templates")) {
      return { rows: [{ id: 12, version: 2 }] };
    }
    return { rows: [] };
  });

  await service.updateTemplate(12, { course_category: "coding" });

  const update = calls.find((call) => call.sql.startsWith("UPDATE course_templates"));
  assert.equal(update.params[4], "/cover.webp");
  assert.equal(update.params[6], JSON.stringify(["Build a game"]));
  assert.equal(update.params[7], true);
  assert.equal(update.params[10], "coding");
});

test("template rollback replaces visible structure without deleting learner history", async () => {
  const calls = [];
  const schoolCourse = {
    id: 12,
    school_id: 4,
    template_id: 7,
    template_version: 1,
  };
  const service = loadServiceWithQuery(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("FROM courses c") && sql.includes("LEFT JOIN course_templates")) {
      return { rows: [schoolCourse] };
    }
    if (sql.startsWith("SELECT * FROM course_templates WHERE id = $1")) {
      return {
        rows: [
          {
            id: 7,
            version: 2,
            name: "Scratch",
            learning_objectives: [],
            course_category: "coding",
          },
        ],
      };
    }
    if (sql.includes("FROM course_template_modules")) return { rows: [] };
    // The post-sync guard counts what is now linked; with no template modules
    // above, nothing should be.
    if (sql.includes("AS linked_modules")) return { rows: [{ linked_modules: 0 }] };
    return { rows: [], rowCount: 1 };
  });

  await service.rollbackSchoolCourse(12, {
    role: "school_admin",
    schoolId: 4,
  });

  const archivedModules = calls.find(
    (call) => call.sql.startsWith("UPDATE course_modules") && call.sql.includes("archived_at"),
  );
  const archivedActivities = calls.find(
    (call) => call.sql.startsWith("UPDATE learning_activities la") && call.sql.includes("archived_at"),
  );
  assert.deepEqual(archivedModules.params, [12]);
  assert.deepEqual(archivedActivities.params, [12]);
  assert.ok(!calls.some((call) => call.sql.startsWith("DELETE FROM")));
  assert.ok(!calls.some((call) => call.sql.includes(" USING ")));
});
