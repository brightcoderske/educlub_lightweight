const test = require("node:test");
const assert = require("node:assert/strict");

// Who a school had in a term. One rule decides it for the invoice, the
// custodian's school view and the dashboards' "Club growth" chart. These tests
// run the real services over a stand-in for the database and pin down that the
// rule closes the ways round it: not promoting a class, and letting a class
// work on through last term's courses.
//
// The stand-in is installed before the services are loaded, because they take
// their dependencies at load time.
const config = require("../src/config");

let rows = [];
const statements = [];
config.query = async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ").trim();
  statements.push({ sql, params });
  if (/^SELECT \* FROM schools WHERE id = \$1/.test(sql)) {
    return { rows: [{ id: params[0], name: "Bright Coders", invoice_rate_per_learner: 500 }] };
  }
  return { rows };
};

const billingIdentity = require("../src/services/billingIdentity.service");
billingIdentity.getBillingIdentity = async () => ({ vat_registered: false });

const {
  countLearnersInTerm,
  getSchoolPopulation,
  getLearnerTrend,
} = require("../src/services/schoolPopulation.service");
const billing = require("../src/services/schoolBilling.service");

function term(name, year, count, isCurrent = 0) {
  return { academic_year: year, term: name, learner_count: String(count), is_current: isCurrent };
}

const lastSql = () => statements[statements.length - 1].sql;

test("a learner counts once in a term however many ways they are in it", async () => {
  rows = [term("Term 1", 2026, 3, 1)];
  await getSchoolPopulation(2);
  assert.match(lastSql(), /COUNT\(DISTINCT r\.learner_id\)/);
});

test("the roll, the term's courses and work done in its dates all place a learner in it", async () => {
  rows = [];
  await countLearnersInTerm(2, "Term 3", 2026);
  const sql = lastSql();

  // Placement alone empties past terms on promotion; allocations alone leave a
  // new term at zero; and neither sees a class left on last term's courses.
  assert.match(sql, /FROM learners l JOIN academic_years ay ON ay\.year = l\.academic_year JOIN terms t ON t\.academic_year_id = ay\.id AND t\.name = l\.term/);
  assert.match(sql, /FROM course_allocations ca .* WHERE l\.school_id = \$1 AND ca\.status <> 'dropped'/);
  for (const [table, column] of [
    ["activity_progress", "opened_at"],
    ["activity_progress", "completed_at"],
    ["activity_submissions", "submitted_at"],
    ["quiz_attempts", "submitted_at"],
    ["quiz_test_attempts", "submitted_at"],
    ["typing_attempts", "submitted_at"],
    ["typing_practice_attempts", "submitted_at"],
  ]) {
    assert.ok(
      sql.includes(`FROM ${table} w JOIN learners l ON l.id = w.learner_id JOIN terms t ON DATE(w.${column}) BETWEEN t.start_date AND t.end_date WHERE l.school_id = $1`),
      `work in ${table}.${column} places a learner in the term it was done in`,
    );
  }
});

test("the invoice is the same count the school's chart shows", async () => {
  rows = [{ learner_count: "27" }];
  const preview = await billing.previewInvoice(2, "Term 3", 2026);

  assert.equal(preview.learner_count, 27);
  assert.equal(preview.amount, 27 * 500);
  const counted = statements.find(({ sql }) => /^SELECT COUNT\(DISTINCT r\.learner_id\) AS learner_count/.test(sql));
  assert.deepEqual(counted.params, [2, "Term 3", 2026]);
  assert.match(counted.sql, /WHERE t\.name = \$2 AND ay\.year = \$3$/);
});

test("the dashboards show the current term and the five before it", async () => {
  rows = [
    term("Term 1", 2025, 10),
    term("Term 2", 2025, 12),
    term("Term 3", 2025, 15),
    term("Term 1", 2026, 18),
    term("Term 2", 2026, 20),
    term("Term 3", 2026, 22),
    term("Term 1", 2027, 25, 1),
  ];
  const trend = await getLearnerTrend(2);
  assert.deepEqual(
    trend.map((t) => [t.term, t.academic_year, t.learner_count]),
    [
      ["Term 2", 2025, 12],
      ["Term 3", 2025, 15],
      ["Term 1", 2026, 18],
      ["Term 2", 2026, 20],
      ["Term 3", 2026, 22],
      ["Term 1", 2027, 25],
    ],
  );
  assert.equal(trend[5].is_current, true);
  assert.equal(trend[0].is_current, false);
  assert.equal((await getSchoolPopulation(2)).length, 7, "the custodian sees every term");
});

test("terms before the school's first learner are left out, a later empty term is kept", async () => {
  rows = [
    term("Term 1", 2026, 0),
    term("Term 2", 2026, 20),
    term("Term 3", 2026, 0),
    term("Term 1", 2027, 25, 1),
  ];
  assert.deepEqual(
    (await getLearnerTrend(2)).map((t) => t.learner_count),
    [20, 0, 25],
  );
});

test("a school with no learners in any term has no trend", async () => {
  rows = [term("Term 1", 2026, 0), term("Term 2", 2026, 0, 1)];
  assert.deepEqual(await getLearnerTrend(2), []);
});
