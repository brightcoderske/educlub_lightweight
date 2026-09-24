const test = require("node:test");
const assert = require("node:assert/strict");

// Bulk allocation gives a course to a whole class for the active term. It used to
// be one INSERT ... SELECT ... RETURNING, which failed with "Column 'id' in field
// list is ambiguous" every time on MySQL and MariaDB. These tests run the real
// controller over a small in-memory stand-in for the tables it touches, and pin
// down the rule the person asked for: nobody is allocated twice.
//
// The stand-ins are installed before the controller is loaded, because it takes
// its dependencies at load time.
const config = require("../src/config");
const transaction = require("../src/database/transaction");

const TERM = { name: "Term 3", academic_year: 2026 };
const state = { learners: [], allocations: [], courses: [], statements: [], nextId: 1 };
const notifications = [];

const rows = (list) => ({ rows: list, rowCount: list.length });

async function answer(text, params = []) {
  const sql = text.replace(/\s+/g, " ").trim();
  state.statements.push(sql);

  if (/^SELECT id, name FROM courses WHERE id = \$1 AND school_id = \$2 AND is_active = true/.test(sql)) {
    return rows(state.courses.filter((c) => c.id === Number(params[0]) && c.school_id === Number(params[1])));
  }
  // The school's roster, narrowed to a stream when one was asked for. Which of them
  // are in the chosen grade is the controller's decision, so it is not made here.
  if (/^SELECT id, grade FROM learners WHERE school_id = \$1 AND graduation_status <> 'graduated'/.test(sql)) {
    const [schoolId, stream] = params;
    assert.equal(/AND stream = \$2$/.test(sql), stream !== undefined, "a stream is filtered on exactly when one was given");
    return rows(
      state.learners
        .filter((l) => l.school_id === Number(schoolId) && l.graduation_status !== "graduated" && (!stream || l.stream === stream))
        .map((l) => ({ id: l.id, grade: l.grade })),
    );
  }
  if (/^SELECT id, learner_id, status FROM course_allocations/.test(sql)) {
    const [courseId, term, year, learnerIds] = params;
    return rows(
      state.allocations.filter(
        (a) => a.course_id === courseId && a.term === term && a.academic_year === year && learnerIds.includes(a.learner_id),
      ),
    );
  }
  if (/^SELECT \* FROM course_allocations WHERE course_id/.test(sql)) {
    const [courseId, term, year, learnerIds] = params;
    return rows(
      state.allocations.filter(
        (a) => a.course_id === courseId && a.term === term && a.academic_year === year && learnerIds.includes(a.learner_id),
      ),
    );
  }
  if (/^INSERT INTO course_allocations \(learner_id, course_id, term, academic_year, status\) VALUES/.test(sql)) {
    const [courseId, term, year, ...learnerIds] = params;
    for (const learnerId of learnerIds) {
      const clash = state.allocations.some(
        (a) => a.learner_id === learnerId && a.course_id === courseId && a.term === term && a.academic_year === year,
      );
      if (!clash) {
        state.allocations.push({ id: state.nextId++, learner_id: learnerId, course_id: courseId, term, academic_year: year, status: "active", completed_at: null });
      }
    }
    return rows([]);
  }
  if (/^UPDATE course_allocations SET status = 'active', completed_at = NULL WHERE id = ANY\(\$1\)/.test(sql)) {
    for (const allocation of state.allocations) {
      if (params[0].includes(allocation.id)) Object.assign(allocation, { status: "active", completed_at: null });
    }
    return rows([]);
  }
  throw new Error(`a bulk allocation test ran a statement it has no answer for: ${sql}`);
}

config.query = answer;
transaction.withTransaction = async (callback) => callback({ query: answer });

const academicService = require("../src/services/academic.service");
const notificationsService = require("../src/services/notifications.service");
academicService.getActiveTerm = async () => ({ ...TERM, start_date: "2026-09-01" });
notificationsService.notifyRole = async (role, payload) => notifications.push({ role, ...payload });

const controller = require("../src/controllers/allocations.controller");
const { fakeResponse } = require("./fakeResponse");

const admin = { role: "system_admin", userId: 1 };
const schoolAdmin = { role: "school_admin", userId: 2, schoolId: 2 };

function reset() {
  state.courses = [
    { id: 5, school_id: 2, name: "Robotics 1" },
    { id: 6, school_id: 9, name: "Another school's course" },
  ];
  state.learners = [
    { id: 1, school_id: 2, grade: "Grade 5", stream: "A" },
    { id: 2, school_id: 2, grade: "Grade 5", stream: "A" },
    { id: 3, school_id: 2, grade: "Grade 5", stream: "B" },
    { id: 4, school_id: 2, grade: "5", stream: "B" }, // the same class, typed without the word
    { id: 5, school_id: 2, grade: "Grade 6", stream: "A" },
    { id: 6, school_id: 9, grade: "Grade 5", stream: "A" }, // another school's learner
    { id: 7, school_id: 2, grade: null, stream: "A" }, // no grade recorded
    { id: 8, school_id: 2, grade: "PP5", stream: "A" }, // ends in a 5, but is not Grade 5
    { id: 9, school_id: 2, grade: "Grade 5", stream: "A", graduation_status: "graduated" },
  ];
  state.allocations = [];
  state.statements = [];
  state.nextId = 1;
  notifications.length = 0;
}

const body = (overrides = {}) => ({
  school_id: 2,
  grade: "Grade 5",
  course_id: 5,
  term: TERM.name,
  academic_year: TERM.academic_year,
  ...overrides,
});

async function bulk(request) {
  const res = fakeResponse();
  await controller.bulkAllocate(request, res);
  return res;
}

const statusOf = (learnerId) => state.allocations.find((a) => a.learner_id === learnerId)?.status;

test("every learner in the class is allocated, and the answer says how many", async () => {
  reset();

  const res = await bulk({ user: admin, body: body() });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.allocated, 4, "grade 5 in school 2 is four learners, however the grade was typed");
  assert.equal(res.body.alreadyAllocated, 0);
  assert.equal(res.body.matchedLearners, 4);
  assert.equal(res.body.allocations.length, 4);
  assert.equal(res.body.message, "Allocated 4 learners to Robotics 1.");
  assert.deepEqual(state.allocations.map((a) => a.learner_id).sort(), [1, 2, 3, 4]);
});

test("running it again adds nobody, and says so", async () => {
  reset();
  await bulk({ user: admin, body: body() });

  const again = await bulk({ user: admin, body: body() });

  assert.equal(again.statusCode, 200, "nothing was created, so nothing is reported as created");
  assert.equal(again.body.allocated, 0);
  assert.equal(again.body.alreadyAllocated, 4);
  assert.equal(again.body.message, "All 4 matching learners already had Robotics 1 for Term 3 2026.");
  assert.equal(state.allocations.length, 4, "no learner holds the course twice");
});

test("someone already allocated is left alone and the rest are added", async () => {
  reset();
  state.allocations.push({ id: 90, learner_id: 1, course_id: 5, term: TERM.name, academic_year: TERM.academic_year, status: "active", completed_at: null });

  const res = await bulk({ user: admin, body: body() });

  assert.equal(res.body.allocated, 3);
  assert.equal(res.body.alreadyAllocated, 1);
  assert.equal(res.body.message, "Allocated 3 learners to Robotics 1. 1 learner already had it and was left as they are.");
  assert.equal(state.allocations.filter((a) => a.learner_id === 1).length, 1);
});

test("a switched-off allocation is switched back on, and a completed one is never reset", async () => {
  reset();
  await bulk({ user: admin, body: body() });
  state.allocations.find((a) => a.learner_id === 1).status = "dropped";
  state.allocations.find((a) => a.learner_id === 2).status = "inactive";
  Object.assign(state.allocations.find((a) => a.learner_id === 3), { status: "completed", completed_at: "2026-09-20" });

  const res = await bulk({ user: admin, body: body() });

  assert.equal(statusOf(1), "active");
  assert.equal(statusOf(2), "active");
  assert.equal(statusOf(3), "completed", "finishing the course is not undone by allocating the class again");
  assert.equal(state.allocations.find((a) => a.learner_id === 3).completed_at, "2026-09-20");
  assert.equal(res.body.allocated, 2);
  assert.equal(res.body.alreadyAllocated, 2);
  assert.equal(state.allocations.length, 4);
});

test("only the chosen stream is allocated", async () => {
  reset();

  const res = await bulk({ user: admin, body: body({ stream: "B" }) });

  assert.equal(res.body.allocated, 2);
  assert.deepEqual(state.allocations.map((a) => a.learner_id).sort(), [3, 4]);
});

test("the class is found however its grade was typed, and only that class", async () => {
  reset();
  state.learners.push(
    { id: 10, school_id: 2, grade: " grade 5 ", stream: "A" },
    { id: 11, school_id: 2, grade: "GRADE5", stream: "A" },
  );

  const res = await bulk({ user: admin, body: body({ grade: "5" }) });

  // Not the learner with no grade, the one whose grade merely ends in a digit, or the graduate.
  assert.deepEqual(state.allocations.map((a) => a.learner_id).sort((a, b) => a - b), [1, 2, 3, 4, 10, 11]);
  assert.equal(res.body.matchedLearners, 6);
});

test("a learner who has graduated is not in the class any more", async () => {
  reset();

  const res = await bulk({ user: admin, body: body() });

  assert.ok(!state.allocations.some((a) => a.learner_id === 9), "the graduate holds no new allocation");
  assert.equal(res.body.matchedLearners, 4);
});

test("something that is not a grade allocates nobody, rather than everyone who has no grade", async () => {
  reset();

  for (const grade of ["Kindergarten", "PP1", "Grade 13", "Grade", "  "]) {
    const res = await bulk({ user: admin, body: body({ grade }) });
    assert.equal(res.statusCode, 400, `"${grade}" is not a grade`);
  }
  assert.equal(state.allocations.length, 0, "the learner with no grade was never picked up");
});

test("a school admin allocates their own school, whatever school the request names", async () => {
  reset();

  const res = await bulk({ user: schoolAdmin, body: body({ school_id: 9 }) });

  assert.equal(res.body.allocated, 4);
  assert.ok(state.allocations.every((a) => a.learner_id !== 6), "another school's learner is never touched");
});

test("a class with nobody in it says so instead of failing", async () => {
  reset();

  const res = await bulk({ user: admin, body: body({ grade: "Grade 9" }) });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "No learners matched the selected grade and stream.");
  assert.equal(res.body.matchedLearners, 0);
  assert.equal(state.allocations.length, 0);
});

test("the grade and the course have to be chosen", async () => {
  reset();

  assert.equal((await bulk({ user: admin, body: body({ grade: "" }) })).statusCode, 400);
  assert.equal((await bulk({ user: admin, body: body({ course_id: undefined }) })).statusCode, 400);
  assert.equal(state.allocations.length, 0, "an empty grade must not match every learner with no grade");
});

test("a course that is not the school's is refused", async () => {
  reset();

  const res = await bulk({ user: admin, body: body({ course_id: 6 }) });

  assert.equal(res.statusCode, 403);
  assert.equal(state.allocations.length, 0);
});

test("only the active term can be allocated", async (t) => {
  t.mock.method(console, "error", () => {});
  reset();

  const res = await bulk({ user: admin, body: body({ term: "Term 1" }) });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /only in the active term: Term 3 2026/);
  assert.equal(state.allocations.length, 0);
});

test("the school admins are told once, with the number who were actually allocated", async () => {
  reset();

  await bulk({ user: admin, body: body() });
  await bulk({ user: admin, body: body() });

  assert.equal(notifications.length, 1, "the second run allocated nobody, so it says nothing");
  assert.equal(notifications[0].message, "4 learners allocated to Robotics 1.");
});

test("it never asks the database for RETURNING on an INSERT ... SELECT", async () => {
  reset();

  await bulk({ user: admin, body: body() });

  const writes = state.statements.filter((sql) => /^(INSERT|UPDATE)/.test(sql));
  assert.ok(writes.length > 0);
  for (const sql of writes) {
    assert.doesNotMatch(sql, /RETURNING/, "the statement that failed every time");
    assert.doesNotMatch(sql, /INSERT INTO [^(]+\([^)]*\) SELECT/i);
  }
  assert.match(writes[0], /ON CONFLICT \(learner_id, course_id, term, academic_year\) DO NOTHING/);
});

test("allocating one learner who already has the course is a plain 409, not a server error", async (t) => {
  t.mock.method(console, "error", () => {});
  reset();
  const duplicate = Object.assign(new Error("Duplicate entry '1-5-Term 3-2026' for key 'learner_id'"), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
  });
  config.query = async (text, params) => {
    if (/^INSERT INTO course_allocations/.test(text.replace(/\s+/g, " ").trim())) throw duplicate;
    return answer(text, params);
  };
  // The controller took `query` when it loaded, so drive the single-allocation
  // path through a controller loaded against this failing insert.
  delete require.cache[require.resolve("../src/controllers/allocations.controller")];
  const failing = require("../src/controllers/allocations.controller");
  const res = fakeResponse();

  await failing.createAllocation(
    { user: admin, body: { learner_id: 1, course_id: 5, term: TERM.name, academic_year: TERM.academic_year } },
    res,
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "That learner already has this course for Term 3 2026.");
  assert.doesNotMatch(res.body.error, /Duplicate entry/, "the database's own wording is not passed on");
});
