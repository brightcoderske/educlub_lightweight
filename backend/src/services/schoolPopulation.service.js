const { query } = require("../config");

// Every place a learner's own work is stamped with when they did it.
const WORK_TIMESTAMPS = [
  ["activity_progress", "opened_at"],
  ["activity_progress", "completed_at"],
  ["activity_submissions", "submitted_at"],
  ["quiz_attempts", "submitted_at"],
  ["quiz_test_attempts", "submitted_at"],
  ["typing_attempts", "submitted_at"],
  ["typing_practice_attempts", "submitted_at"],
];

/**
 * Which of a school's learners were in which term, as (learner_id, term_id)
 * pairs. This is the one rule for "a learner the school had in a term", used
 * for the invoice and for every chart of it, so a school sees what it pays for.
 *
 * A learner counts in a term if any of these holds:
 * - they are on its roll (placed in it, and active);
 * - they were given a course in it;
 * - they did work - opened or finished an activity, submitted, took a quiz or
 *   a typing test - between its start and end dates.
 *
 * No one signal is enough. Placement moves forward on promotion, so past terms
 * need the allocations, which never move. A new term has nobody allocated until
 * the school allocates, so it needs the roll. And course access does not end
 * with the term, so a learner left unpromoted and unallocated can keep working
 * through last term's courses; only the dates of their work place them.
 *
 * Each branch is filtered to the school itself so none of them scans every
 * school's rows. `$1` is the school id.
 */
const LEARNER_TERMS = [
  `SELECT l.id AS learner_id, t.id AS term_id
   FROM learners l
   JOIN academic_years ay ON ay.year = l.academic_year
   JOIN terms t ON t.academic_year_id = ay.id AND t.name = l.term
   WHERE l.school_id = $1 AND l.is_active = true`,
  `SELECT ca.learner_id, t.id
   FROM course_allocations ca
   JOIN learners l ON l.id = ca.learner_id
   JOIN academic_years ay ON ay.year = ca.academic_year
   JOIN terms t ON t.academic_year_id = ay.id AND t.name = ca.term
   WHERE l.school_id = $1 AND ca.status <> 'dropped'`,
  ...WORK_TIMESTAMPS.map(
    ([table, column]) => `SELECT w.learner_id, t.id
   FROM ${table} w
   JOIN learners l ON l.id = w.learner_id
   JOIN terms t ON DATE(w.${column}) BETWEEN t.start_date AND t.end_date
   WHERE l.school_id = $1`,
  ),
].join("\nUNION\n");

/** How many learners a school had in one term. This is the billable quantity. */
async function countLearnersInTerm(schoolId, term, academicYear) {
  const result = await query(
    `SELECT COUNT(DISTINCT r.learner_id) AS learner_count
     FROM (${LEARNER_TERMS}) r
     JOIN terms t ON t.id = r.term_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.name = $2 AND ay.year = $3`,
    [schoolId, term, academicYear],
  );
  return Number(result.rows[0]?.learner_count) || 0;
}

/**
 * The school's learners, term by term, from the first term it had anyone
 * through to the current one. Used for the system admin's custodian view of a
 * school, which bills per learner per term.
 *
 * Driven from `terms` so a term the school had nobody in still appears as a
 * zero. Deriving the series from learner rows would silently drop those terms,
 * close the gap, and turn a dip into a flat line.
 */
async function getSchoolPopulation(schoolId) {
  const result = await query(
    `SELECT ay.year AS academic_year, t.name AS term, t.start_date,
            t.is_active AS is_current,
            COUNT(DISTINCT r.learner_id) AS learner_count
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     LEFT JOIN (${LEARNER_TERMS}) r ON r.term_id = t.id
     WHERE t.start_date <= CURRENT_DATE OR t.is_active = true
     GROUP BY ay.year, t.name, t.start_date, t.is_active
     ORDER BY t.start_date`,
    [schoolId],
  );

  const terms = result.rows.map((row) => ({
    ...row,
    learner_count: Number(row.learner_count) || 0,
    // MySQL hands booleans back as 1/0, so the flag is normalised here rather
    // than in each page that reads it.
    is_current: Boolean(row.is_current),
  }));
  // Terms before the school's first learner are before it joined, not a dip.
  const firstTerm = terms.findIndex((term) => term.learner_count > 0);
  return firstTerm === -1 ? [] : terms.slice(firstTerm);
}

// The current term plus the five before it.
const TREND_TERMS = 6;

/** Club growth on the school's dashboards: the latest stretch of the same series. */
async function getLearnerTrend(schoolId) {
  return (await getSchoolPopulation(schoolId)).slice(-TREND_TERMS);
}

module.exports = { countLearnersInTerm, getSchoolPopulation, getLearnerTrend };
