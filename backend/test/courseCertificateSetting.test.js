const test = require("node:test");
const assert = require("node:assert/strict");

// Courses service with every query recorded. Each call answers with one row.
function serviceRecordingQueries() {
  const calls = [];
  const configPath = require.resolve("../src/config");
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [{ id: 1 }] };
      },
    },
  };
  delete require.cache[require.resolve("../src/services/courses.service")];
  return { service: require("../src/services/courses.service"), calls };
}

const certificateParam = (call) => {
  // Both statements list certificate_enabled as the ninth value.
  assert.match(call.sql, /certificate_enabled/);
  return call.params[8];
};

test("a new course awards a certificate unless it is made without one", async () => {
  const { service, calls } = serviceRecordingQueries();
  await service.createCourse({ name: "Web" });
  await service.createCourse({ name: "Web", certificate_enabled: false });
  const inserts = calls.filter((call) => /INSERT INTO courses/.test(call.sql));
  assert.equal(certificateParam(inserts[0]), true);
  assert.equal(certificateParam(inserts[1]), false);
});

test("editing a course keeps its certificate setting when the edit does not mention it", async () => {
  const { service, calls } = serviceRecordingQueries();
  await service.updateCourse(1, { name: "Web" });
  await service.updateCourse(1, { name: "Web", certificate_enabled: false });
  const updates = calls.filter((call) => /UPDATE courses/.test(call.sql));
  assert.match(updates[0].sql, /COALESCE\(\$9, c\.certificate_enabled\)/);
  assert.equal(certificateParam(updates[0]), null, "absent means keep, not switch off");
  assert.equal(certificateParam(updates[1]), false);
});

test("weekly typing and quiz courses never award a certificate", async () => {
  const { service, calls } = serviceRecordingQueries();
  await service.courseCompletionSummary(9, 4);
  assert.match(calls[0].sql, /NOT IN \('weekly_typing', 'weekly_quiz'\)/);
});
