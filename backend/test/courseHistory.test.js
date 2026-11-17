const test = require("node:test");
const assert = require("node:assert/strict");

function serviceWithQuery(query) {
  const configPath = require.resolve("../src/config");
  require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { query } };
  delete require.cache[require.resolve("../src/services/courseProgress.service")];
  return require("../src/services/courseProgress.service");
}

const snapshot = {
  course_id: 9, course_name: "Scratch", completion_percent: 70, score_percent: 80,
  completed_modules: 2, total_modules: 3, grade_label: "Meeting Expectations", modules: [],
};

test("revisiting a completed term returns the saved report without reading or overwriting today's activity progress", async () => {
  let reads = 0;
  const service = serviceWithQuery(async (sql) => {
    assert.doesNotMatch(sql, /INSERT|UPDATE|activity_progress/);
    reads++;
    if (sql.includes("SELECT * FROM learners")) return { rows: [{ id: 4 }] };
    if (sql.includes("SELECT a.id AS allocation_id")) return { rows: [{ id: 9, term: "Term 2", academic_year: 2025, is_closed_period: 1 }] };
    if (sql.includes("SELECT pc.progress_data")) return { rows: [{ progress_data: snapshot }] };
    throw new Error("Unexpected query");
  });
  assert.deepEqual(await service.getLearnerCourseProgress(4, "Term 2", 2025), [snapshot]);
  assert.equal(reads, 3);
});

test("school progress preserves completed-term snapshots and does not recalculate the historical cohort", async () => {
  let reads = 0;
  const service = serviceWithQuery(async (sql) => {
    reads++;
    assert.doesNotMatch(sql, /INSERT|UPDATE|activity_progress/);
    return { rows: [{ id: 4, full_name: "History learner", grade: "Grade 4", stream: "A", course_name: "Scratch", is_closed_period: 1, cached_progress: snapshot }] };
  });
  const results = await service.getSchoolCourseProgress({ schoolId: 3, courseId: 9, term: "Term 2", academicYear: 2025 });
  assert.equal(results[0].completion_percent, 70);
  assert.equal(results[0].score_percent, 80);
  assert.equal(reads, 1);
});

test("a module reports how many activities were opened, apart from the mark", async () => {
  // Ten activities: one finished (100 marks), one only opened, eight untouched.
  const statuses = ["completed", "started", ...Array(8).fill("not_started")];
  const activityRows = statuses.map((status, index) => ({
    learner_id: 4, module_id: 1, module_title: "Module 1", module_position: 1,
    activity_id: index + 1, activity_title: `Activity ${index + 1}`, activity_type: "lesson",
    activity_position: index + 1, availability_mode: "required", progress_status: status,
    score: status === "completed" ? 100 : null,
  }));
  const service = serviceWithQuery(async (sql) => {
    if (sql.includes("FROM learners l")) {
      return { rows: [{ id: 4, full_name: "Current learner", course_name: "Web", is_closed_period: 0 }] };
    }
    if (sql.includes("CROSS JOIN course_modules")) return { rows: activityRows };
    if (sql.includes("INSERT INTO progress_cache")) return { rows: [] };
    throw new Error(`Unexpected query: ${sql.slice(0, 60)}`);
  });
  const [row] = await service.getSchoolCourseProgress({ schoolId: 3, courseId: 9 });
  const [module] = row.modules;
  assert.equal(module.score_percent, 100, "the mark averages only what was attempted");
  assert.equal(module.opened_activities, 2);
  assert.equal(module.opened_percent, 20);
  assert.equal(module.completed_activities, 1);
  assert.equal(module.progress_percent, 10);
  assert.equal(module.total_activities, 10);
});

test("a completed term without a snapshot does not invent historical progress", async () => {
  const service = serviceWithQuery(async (sql) => {
    assert.doesNotMatch(sql, /INSERT|UPDATE|activity_progress/);
    return { rows: [{ id: 4, is_closed_period: 1, cached_progress: null }] };
  });
  assert.deepEqual(await service.getSchoolCourseProgress({ schoolId: 3, courseId: 9, term: "Term 2", academicYear: 2025 }), []);
});
