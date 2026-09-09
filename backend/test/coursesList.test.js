const test = require("node:test");
const assert = require("node:assert/strict");

const configPath = require.resolve("../src/config");

function loadServiceWithQuery(queryImpl) {
  delete require.cache[require.resolve("../src/services/courses.service")];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { query: queryImpl },
  };
  return require("../src/services/courses.service");
}

test("school course list keeps allocation fields without requiring learner allocations", async () => {
  const service = loadServiceWithQuery(async (sql, params) => {
    assert.match(sql, /LEFT JOIN course_allocations a ON false/);
    assert.match(sql, /a\.access_level/);
    assert.deepEqual(params, ["general", 4]);
    return { rows: [{ id: 12, name: "Scratch", access_level: null }] };
  });

  const courses = await service.getAllCourses({
    category: "general",
    user: { role: "school_admin", schoolId: 4 },
  });

  assert.equal(courses[0].name, "Scratch");
});

test("learner course list joins the learner allocation for preview access details", async () => {
  const service = loadServiceWithQuery(async (sql, params) => {
    assert.match(sql, /LEFT JOIN course_allocations a\s+ON a\.course_id = c\.id/);
    assert.match(sql, /AND a\.id IS NOT NULL/);
    assert.deepEqual(params, ["general", 88]);
    return { rows: [{ id: 12, name: "Scratch", access_level: "preview" }] };
  });

  const courses = await service.getAllCourses({
    category: "general",
    user: { role: "learner", userId: 88 },
  });

  assert.equal(courses[0].access_level, "preview");
});

test("standard course lists include reusable subject categories but exclude weekly system courses", async () => {
  const service = loadServiceWithQuery(async (sql, params) => {
    assert.match(
      sql,
      /COALESCE\(c\.course_category, 'general'\) NOT IN \('weekly_typing', 'weekly_quiz'\)/,
    );
    assert.deepEqual(params, [4]);
    return { rows: [{ id: 12, course_category: "web_development" }] };
  });

  const courses = await service.getAllCourses({
    category: "standard",
    user: { role: "school_admin", schoolId: 4 },
  });

  assert.equal(courses[0].course_category, "web_development");
});

test("course categories accept reusable human-entered values", () => {
  const service = loadServiceWithQuery(async () => ({ rows: [] }));
  assert.equal(service.normalizeCourseCategory(" Web Development "), "web_development");
  assert.equal(service.normalizeCourseCategory(""), "general");
});

test("dashboard course count is a scoped database aggregate", async () => {
  const service = loadServiceWithQuery(async (sql, params) => {
    assert.match(sql, /SELECT COUNT\(\*\) AS count/);
    assert.match(sql, /c\.school_id = \$1/);
    assert.deepEqual(params, [4]);
    return { rows: [{ count: 7 }] };
  });

  assert.equal(
    await service.getCourseCount({ user: { role: "school_admin", schoolId: 4 } }),
    7,
  );
});

test("school admins soft-delete only their own course so learning history remains", async () => {
  const service = loadServiceWithQuery(async (sql, params) => {
    assert.match(sql, /UPDATE courses/);
    assert.match(sql, /deleted_at = CURRENT_TIMESTAMP/);
    assert.doesNotMatch(sql, /DELETE FROM courses/);
    assert.match(sql, /school_id = \$2/);
    assert.deepEqual(params, [12, 4]);
    return { rows: [], rowCount: 1 };
  });

  assert.equal(
    await service.deleteCourse(12, { role: "school_admin", schoolId: 4 }),
    true,
  );
});

test("independent preview limits access to the configured first activities only", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../src/services/courses.service.js"),
    "utf8",
  );

  assert.match(source, /const activityLimit = Math\.max/);
  assert.match(source, /const allowedByPreview = inFirstModule && activityUsed < activityLimit/);
  assert.doesNotMatch(source, /first_module_included: true/);
  assert.match(source, /preview_activity_limit: activityLimit/);
});

test("independent course sync does not overwrite a configured price with template zero", () => {
  const source = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "../src/services/independentLearners.service.js"),
    "utf8",
  );

  assert.match(source, /NULLIF\(t\.independent_price_amount, 0\)/);
  assert.match(source, /NULLIF\(c\.independent_price_amount, 0\)/);
});
