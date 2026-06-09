const { query } = require("../config");
const {
  calculateWeeks,
  getCurrentWeekNumber,
  parseDate,
  formatDate,
} = require("../utils/weekCalculator");

async function getAllAcademicYears() {
  const result = await query("SELECT * FROM academic_years ORDER BY year DESC");
  return result.rows;
}

async function createAcademicYear(yearData) {
  const { year, start_date, end_date, is_active } = yearData;

  const result = await query(
    `INSERT INTO academic_years (year, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [year, start_date, end_date, is_active]
  );
  return result.rows[0];
}

async function getAcademicYearById(id) {
  const result = await query("SELECT * FROM academic_years WHERE id = $1", [
    id,
  ]);
  return result.rows[0];
}

async function updateAcademicYear(id, yearData) {
  const { year, start_date, end_date, is_active } = yearData;

  const result = await query(
    `UPDATE academic_years
     SET year = $1, start_date = $2, end_date = $3, is_active = $4
     WHERE id = $5
     RETURNING *`,
    [year, start_date, end_date, is_active, id]
  );
  return result.rows[0];
}

async function deleteAcademicYear(id) {
  await query("DELETE FROM academic_years WHERE id = $1", [id]);
}

async function getAllTerms() {
  const result = await query(
    "SELECT * FROM terms ORDER BY academic_year DESC, name"
  );
  return result.rows;
}

async function getActiveTerm(termType = "regular") {
  const result = await query(
    `SELECT t.*, ay.year AS academic_year
     FROM terms t
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.term_type = $1
       AND CURRENT_DATE BETWEEN t.start_date AND t.end_date
     ORDER BY t.start_date DESC
     LIMIT 1`,
    [termType]
  );
  if (result.rows[0]) {
    return result.rows[0];
  }

  const fallback = await query(
    `SELECT t.*, ay.year AS academic_year
     FROM terms t
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.is_active = true AND t.term_type = $1
     ORDER BY t.created_at DESC
     LIMIT 1`,
    [termType]
  );
  return fallback.rows[0];
}

async function getAllActiveTerms() {
  const result = await query(
    "SELECT * FROM terms WHERE is_active = true ORDER BY term_type, created_at DESC"
  );
  return result.rows;
}

async function createTerm(termData) {
  const { academic_year_id, name, term_type, start_date, end_date, is_active } =
    termData;

  // If setting this term as active, deactivate other terms of the same type
  if (is_active) {
    await query(
      "UPDATE terms SET is_active = false WHERE is_active = true AND term_type = $1",
      [term_type || "regular"]
    );
  }

  const result = await query(
    `INSERT INTO terms (academic_year_id, name, term_type, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      academic_year_id,
      name,
      term_type || "regular",
      start_date,
      end_date,
      is_active,
    ]
  );

  const term = result.rows[0];

  // Calculate and create term weeks
  await calculateTermWeeks(term.id);

  return term;
}

async function getTermById(id) {
  const result = await query("SELECT * FROM terms WHERE id = $1", [id]);
  return result.rows[0];
}

async function updateTerm(id, termData) {
  const { academic_year_id, name, term_type, start_date, end_date, is_active } =
    termData;

  // If setting this term as active, deactivate other terms of the same type
  if (is_active) {
    await query(
      "UPDATE terms SET is_active = false WHERE is_active = true AND term_type = $1",
      [term_type || "regular"]
    );
  }

  const result = await query(
    `UPDATE terms
     SET academic_year_id = $1, name = $2, term_type = $3, start_date = $4, end_date = $5, is_active = $6
     WHERE id = $7
     RETURNING *`,
    [
      academic_year_id,
      name,
      term_type || "regular",
      start_date,
      end_date,
      is_active,
      id,
    ]
  );

  const term = result.rows[0];
  if (!term) {
    return null;
  }

  // Recalculate weeks if dates changed
  if (start_date || end_date) {
    await calculateTermWeeks(term.id);
  }

  // If term is being activated, initialize weekly marks
  if (is_active) {
    await initializeWeeklyMarksForTerm(term);
  }

  return term;
}

async function deleteTerm(id) {
  await query("DELETE FROM terms WHERE id = $1", [id]);
}

async function getTermWeeks(termId) {
  const result = await query(
    "SELECT * FROM term_weeks WHERE term_id = $1 ORDER BY week_number",
    [termId]
  );
  return result.rows;
}

async function calculateTermWeeks(termId) {
  // Get term details
  const termResult = await query("SELECT * FROM terms WHERE id = $1", [termId]);
  const term = termResult.rows[0];

  if (!term) {
    throw new Error("Term not found");
  }

  // Use the new week calculator
  const startDate = parseDate(term.start_date);
  const endDate = parseDate(term.end_date);
  const weeks = calculateWeeks(startDate, endDate);

  // Delete existing weeks for this term
  await query("DELETE FROM term_weeks WHERE term_id = $1", [termId]);

  // Create new weeks
  for (const week of weeks) {
    await query(
      `INSERT INTO term_weeks (term_id, week_number, start_date, end_date)
       VALUES ($1, $2, $3, $4)`,
      [termId, week.week_number, week.start_date, week.end_date]
    );
  }

  // Update term with total weeks
  await query("UPDATE terms SET total_weeks = $1 WHERE id = $2", [
    weeks.length,
    termId,
  ]);

  return {
    totalWeeks: weeks.length,
    weeks,
  };
}

async function initializeWeeklyMarksForTerm(term) {
  // Get all active learners
  const learnersResult = await query(
    "SELECT id FROM learners WHERE is_active = true"
  );
  const learners = learnersResult.rows;

  const termName = term.name;
  const academicYear = new Date(term.start_date).getFullYear();

  // Get term weeks
  const weeks = await getTermWeeks(term.id);

  // Initialize weekly marks for each learner and each week
  for (const learner of learners) {
    for (const week of weeks) {
      try {
        await query(
          `INSERT INTO weekly_marks (learner_id, week_number, term, academic_year, quiz_score, typing_score, active_course_score, active_course_modules_completed, active_course_modules_total)
           VALUES ($1, $2, $3, $4, NULL, NULL, NULL, 0, 0)
           ON CONFLICT (learner_id, week_number, term, academic_year) DO NOTHING`,
          [learner.id, week.week_number, termName, academicYear]
        );
      } catch (error) {
        console.error(
          `Failed to initialize weekly marks for learner ${learner.id}, week ${week.week_number}:`,
          error.message
        );
      }
    }
  }

  return { initialized: learners.length * weeks.length };
}

async function getCurrentWeekForTerm(termId) {
  const term = await getTermById(termId);
  if (!term) {
    throw new Error("Term not found");
  }

  const currentWeek = getCurrentWeekNumber(
    parseDate(term.start_date),
    parseDate(term.end_date),
    new Date()
  );

  return currentWeek;
}

module.exports = {
  getAllAcademicYears,
  createAcademicYear,
  getAcademicYearById,
  updateAcademicYear,
  deleteAcademicYear,
  getAllTerms,
  getActiveTerm,
  getAllActiveTerms,
  createTerm,
  getTermById,
  updateTerm,
  deleteTerm,
  getTermWeeks,
  calculateTermWeeks,
  initializeWeeklyMarksForTerm,
  getCurrentWeekForTerm,
};
