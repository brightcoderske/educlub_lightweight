const { query } = require("../config");

/**
 * The school roll, term by term, from the first term it enrolled anyone through
 * to the current one.
 *
 * Driven from `terms` rather than from `learners` so a term the school enrolled
 * nobody in still appears as a zero. Deriving the series from learner rows would
 * silently drop those terms, close the gap, and turn a dip into a flat line.
 */
async function getSchoolPopulation(schoolId) {
  const result = await query(
    `SELECT ay.year AS academic_year, t.name AS term, t.start_date,
            t.is_active AS is_current,
            COUNT(l.id) AS learner_count
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     LEFT JOIN learners l
       ON l.school_id = $1
      AND l.term = t.name
      AND l.academic_year = ay.year
      AND l.is_active = true
     WHERE t.start_date <= CURRENT_DATE
       AND t.start_date >= (
         SELECT MIN(t2.start_date)
         FROM terms t2
         JOIN academic_years ay2 ON ay2.id = t2.academic_year_id
         JOIN learners l2
           ON l2.school_id = $1
          AND l2.term = t2.name
          AND l2.academic_year = ay2.year
       )
     GROUP BY ay.year, t.name, t.start_date, t.is_active
     ORDER BY t.start_date`,
    [schoolId],
  );

  return result.rows.map((row) => ({
    ...row,
    learner_count: Number(row.learner_count) || 0,
    // MySQL hands booleans back as 1/0, so the flag is normalised here rather
    // than in each page that reads it.
    is_current: Boolean(row.is_current),
  }));
}

module.exports = { getSchoolPopulation };
