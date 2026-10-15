const test = require("node:test");
const assert = require("node:assert/strict");

// Review learner work lists one term's learners, not every learner the course
// has ever had. These tests run the real service over a stand-in for the
// database and read back the SQL and parameters it sends, so they pin down the
// scope, not the rows.
//
// The stand-in is installed before the service is loaded, because it takes its
// query function at load time.
const config = require("../src/config");

const TERM_3 = { id: 30, name: "Term 3", academic_year: 2026, start_date: "2026-09-01", end_date: "2026-11-30" };
const TERM_2 = { id: 20, name: "Term 2", academic_year: 2026, start_date: "2026-05-01", end_date: "2026-07-31" };

let allocatedTerms = [];
const sent = [];
config.query = async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ").trim();
  sent.push({ sql, params });
  if (/FROM learning_activities la/.test(sql)) {
    return { rows: [{ id: 7, course_id: 5, title: "Quiz", points: 10, content: {} }] };
  }
  if (/FROM terms t JOIN academic_years ay/.test(sql)) return { rows: allocatedTerms };
  if (/COUNT\(\*\)/.test(sql)) return { rows: [{ total: 120 }] };
  return { rows: [] };
};

const academic = require("../src/services/academic.service");
let currentTerm = TERM_3;
academic.getActiveTerm = async () => currentTerm;

const { getActivityReview } = require("../src/services/courses.service");

const admin = { role: "system_admin" };
const learnerQuery = () => sent.filter((call) => /FROM learners l/.test(call.sql)).at(-1);

test("review defaults to the current term, not every term the course ran", async () => {
  allocatedTerms = [TERM_2];
  const review = await getActivityReview(7, admin);

  const { sql, params } = learnerQuery();
  assert.match(sql, /ca\.term = \$\d+ AND ca\.academic_year = \$\d+/);
  assert.ok(params.includes("Term 3") && params.includes(2026));
  assert.ok(!params.includes("Term 2"));
  assert.equal(review.term_id, TERM_3.id);
});

test("the current term is choosable before anyone is allocated in it", async () => {
  allocatedTerms = [TERM_2];
  const review = await getActivityReview(7, admin);
  assert.deepEqual(
    review.terms.map((term) => [term.id, term.is_current]),
    [[30, true], [20, false]],
  );
});

test("a past term can be chosen, and all terms lifts the filter", async () => {
  allocatedTerms = [TERM_2, TERM_3];

  const past = await getActivityReview(7, admin, { term_id: "20" });
  assert.equal(past.term_id, TERM_2.id);
  assert.ok(learnerQuery().params.includes("Term 2"));

  const all = await getActivityReview(7, admin, { term_id: "all" });
  assert.equal(all.term_id, "all");
  assert.doesNotMatch(learnerQuery().sql, /ca\.term = /);
});

test("work handed in during the term counts even from last term's allocation", async () => {
  allocatedTerms = [TERM_2];
  await getActivityReview(7, admin);
  const { sql, params } = learnerQuery();
  assert.match(sql, /FROM activity_submissions w .* DATE\(w\.submitted_at\) BETWEEN/);
  assert.match(sql, /FROM quiz_attempts w .* DATE\(w\.submitted_at\) BETWEEN/);
  assert.ok(params.includes(TERM_3.start_date) && params.includes(TERM_3.end_date));
});

test("a learner is one row however many terms they were allocated in", async () => {
  allocatedTerms = [TERM_2, TERM_3];
  await getActivityReview(7, admin, { term_id: "all" });
  // Allocations are only tested for, never joined, so they cannot repeat a learner.
  assert.doesNotMatch(learnerQuery().sql, /JOIN course_allocations/);
});

test("a typed % or _ is searched for as a letter", async () => {
  allocatedTerms = [];
  await getActivityReview(7, admin, { search: "50%_off" });
  const { sql, params } = learnerQuery();
  assert.match(sql, /l\.full_name ILIKE/);
  assert.ok(params.includes("%50\\%\\_off%"));
});

test("paging stays within 100 learners a request", async () => {
  allocatedTerms = [];
  const review = await getActivityReview(7, admin, { limit: "5000", offset: "100" });
  assert.deepEqual(review.paging, { total: 120, limit: 100, offset: 100 });
});
