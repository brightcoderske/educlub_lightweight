const test = require("node:test");
const assert = require("node:assert/strict");

// "Graduate" on the Learners page moves a class into a next term and, optionally,
// a next grade. These tests run the real controller over a stand-in for the
// database, and pin down what the operator was never told: which learners it
// moves, and where the academic year on the record comes from.
//
// The stand-ins are installed before the controller is loaded, because it takes
// its dependencies at load time.
const config = require("../src/config");

const written = [];
let updated = [];
config.query = async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ").trim();
  if (/^UPDATE learners SET /.test(sql)) {
    written.push({ sql, params });
    return { rows: updated, rowCount: updated.length };
  }
  throw new Error(`a promotion test ran a statement it has no answer for: ${sql}`);
};

const academicService = require("../src/services/academic.service");
const TERMS = { "Term 1|2027": { term: "Term 1", academic_year: 2027 } };
academicService.resolveTerm = async (name, year) => {
  const found = TERMS[`${name}|${year}`];
  if (!found) throw new Error(`Term "${name}" does not exist. Create it under Academic Years and Terms first.`);
  return found;
};

const controller = require("../src/controllers/learners.controller");
const { fakeResponse } = require("./fakeResponse");

const schoolAdmin = { role: "school_admin", userId: 3, schoolId: 2 };

async function promote(body, user = schoolAdmin) {
  const res = fakeResponse();
  await controller.promoteLearners({ user, body }, res);
  return res;
}

function reset(rows = [{ id: 1 }, { id: 2 }]) {
  written.length = 0;
  updated = rows;
}

test("moving to a term writes the term and its own year, whatever year the client sent", async () => {
  reset();

  const res = await promote({ next_term: "Term 1", academic_year: 2027 });

  assert.equal(res.statusCode, 200);
  const { sql, params } = written[0];
  assert.match(sql, /SET term = \$1, academic_year = \$2, updated_at = NOW\(\)/);
  assert.deepEqual(params.slice(0, 2), ["Term 1", 2027]);
  assert.equal(res.body.message, "Moved 2 learners to Term 1 2027.");
});

test("moving up a grade alone leaves the term and the year exactly as they are", async () => {
  reset();

  const res = await promote({ next_grade: "Grade 6", academic_year: 2099 });

  const { sql, params } = written[0];
  assert.match(sql, /SET grade = \$1, updated_at = NOW\(\)/);
  assert.doesNotMatch(sql, /academic_year/, "a year with no term to belong to is not written");
  assert.doesNotMatch(sql, /term = /);
  assert.equal(params[0], "Grade 6");
  assert.equal(res.body.message, "Moved 2 learners to Grade 6.");
});

test("a term and a grade together are moved in one go", async () => {
  reset([{ id: 1 }]);

  const res = await promote({ next_term: "Term 1", academic_year: 2027, next_grade: "6" });

  assert.match(written[0].sql, /SET grade = \$1, term = \$2, academic_year = \$3/);
  assert.deepEqual(written[0].params.slice(0, 3), ["Grade 6", "Term 1", 2027]);
  assert.equal(res.body.message, "Moved 1 learner to Term 1 2027, Grade 6.");
});

test("a learner who has already graduated is never moved on", async () => {
  reset();

  await promote({ next_term: "Term 1", academic_year: 2027, grade: "Grade 5" });

  assert.match(written[0].sql, /WHERE school_id = \$3 AND graduation_status <> 'graduated' AND grade = \$4/);
});

test("it moves only the school admin's own school", async () => {
  reset();

  await promote({ next_term: "Term 1", academic_year: 2027, school_id: 9 });

  assert.equal(written[0].params[2], 2, "the school comes from the account, not the request");
});

test("one chosen learner is moved and nobody else", async () => {
  reset([{ id: 7 }]);

  await promote({ next_term: "Term 1", academic_year: 2027, learner_ids: [7] });

  assert.match(written[0].sql, /AND id = ANY\(\$4\)/);
  assert.deepEqual(written[0].params[3], [7]);
  assert.doesNotMatch(written[0].sql, /grade = \$/);
});

test("a term that was never created is refused with the reason", async () => {
  reset();

  const res = await promote({ next_term: "Term 9", academic_year: 2030 });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Term "Term 9" does not exist/);
  assert.equal(written.length, 0, "nothing was changed");
});

test("a grade or a term has to be given", async () => {
  reset();

  const res = await promote({});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Next grade or next term is required");
  assert.equal(written.length, 0);
});
