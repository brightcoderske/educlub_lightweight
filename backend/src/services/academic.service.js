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

  if (is_active) {
    await query("UPDATE academic_years SET is_active = false WHERE is_active = true");
  }

  const result = await query(
    `INSERT INTO academic_years (year, start_date, end_date, is_active)
     VALUES ($1::integer, $2::date, $3::date, $4::boolean)
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

  if (is_active) {
    await query(
      "UPDATE academic_years SET is_active = false WHERE is_active = true AND id <> $1::integer",
      [id]
    );
  }

  const result = await query(
    `UPDATE academic_years
     SET year = $1::integer,
         start_date = $2::date,
         end_date = $3::date,
         is_active = $4::boolean,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5::integer
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
    `SELECT t.*,
            ay.year AS academic_year,
            CONCAT(ay.year, ' - ', t.name) AS term_label,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', tw.id,
                  'week_number', tw.week_number,
                  'start_date', tw.start_date,
                  'end_date', tw.end_date
                )
                ORDER BY tw.week_number
              ) FILTER (WHERE tw.id IS NOT NULL),
              '[]'::jsonb
            ) AS weeks
     FROM terms t
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
     LEFT JOIN term_weeks tw ON tw.term_id = t.id
     GROUP BY t.id, ay.year
     ORDER BY ay.year DESC, t.term_type, t.name`
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

// Terms exist only where an operator created them. Any record that stores a
// term string must resolve it here first, so a client cannot invent one such as
// a hardcoded "Term 1" and leave an orphan value on a learner or allocation.
async function resolveTerm(name, academicYear = null) {
  // Nothing asked for: fall back to the active term. When no term exists at all
  // the record is left unset rather than blocked or invented - learners.term is
  // nullable, and the value is filled in once a term exists and they are
  // allocated. Registering learners must not wait on term setup.
  if (!name) {
    const active = await getActiveTerm();
    return active
      ? { term: active.name, academic_year: active.academic_year }
      : { term: null, academic_year: null };
  }

  const result = await query(
    `SELECT t.name, ay.year AS academic_year
     FROM terms t
     LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.name = $1::varchar
       AND ($2::integer IS NULL OR ay.year = $2::integer)
     ORDER BY ay.year DESC NULLS LAST
     LIMIT 1`,
    [name, academicYear ? Number(academicYear) : null]
  );

  if (!result.rows[0]) {
    throw new Error(
      `Term "${name}" does not exist. Create it under Academic Years and Terms first.`
    );
  }

  // Callers store {term, academic_year}; keep one shape for both branches.
  return { term: result.rows[0].name, academic_year: result.rows[0].academic_year };
}

async function getAllActiveTerms() {
  const result = await query(
    "SELECT * FROM terms WHERE is_active = true ORDER BY term_type, created_at DESC"
  );
  return result.rows;
}

async function assertNoDuplicateTerm(termData, id = null) {
  const result = await query(
    `SELECT id
     FROM terms
     WHERE academic_year_id = $1::integer
       AND name = $2::varchar
       AND term_type = $3::varchar
       AND ($4::integer IS NULL OR id <> $4::integer)
     LIMIT 1`,
    [
      termData.academic_year_id,
      termData.name,
      termData.term_type || "regular",
      id ? Number(id) : null,
    ]
  );
  if (result.rows[0]) {
    throw new Error("This academic year already has that term and type.");
  }
}

async function createTerm(termData) {
  const { academic_year_id, name, term_type, start_date, end_date, is_active } =
    termData;

  await assertNoDuplicateTerm(termData);

  // If setting this term as active, deactivate other terms of the same type
  if (is_active) {
    await query(
      "UPDATE terms SET is_active = false WHERE is_active = true AND term_type = $1",
      [term_type || "regular"]
    );
  }

  const result = await query(
    `INSERT INTO terms (academic_year_id, name, term_type, start_date, end_date, is_active)
     VALUES ($1::integer, $2::varchar, $3::varchar, $4::date, $5::date, $6::boolean)
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

  await assertNoDuplicateTerm(termData, id);

  // If setting this term as active, deactivate other terms of the same type
  if (is_active) {
    await query(
      "UPDATE terms SET is_active = false WHERE is_active = true AND term_type = $1",
      [term_type || "regular"]
    );
  }

  const result = await query(
    `UPDATE terms
     SET academic_year_id = $1::integer,
         name = $2::varchar,
         term_type = $3::varchar,
         start_date = $4::date,
         end_date = $5::date,
         is_active = $6::boolean,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7::integer
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
  resolveTerm,
  createTerm,
  getTermById,
  updateTerm,
  deleteTerm,
  getTermWeeks,
  calculateTermWeeks,
  initializeWeeklyMarksForTerm,
  getCurrentWeekForTerm,
};
