const { query } = require("../config");
const { normalizeQuestionMarks } = require("./quizAttemptMarks");
const { answersMatch } = require("./quizAnswerPolicy");
const {
  resolveAssessmentSchoolId,
  resolveAssessmentType,
  assertAssessmentManageAccess,
} = require("./assessmentOwnership");
const {
  resolveAssessmentScope,
  requireConfiguredAssessmentScope,
} = require("./assessmentTermScope");

const QUIZ_CATEGORIES = new Set(["quiz", "maths", "science", "stem"]);

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") return item;
        return String(item || "").trim();
      })
      .filter((item) => (typeof item === "object" ? true : Boolean(item)));
  }
  return [];
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "yes" || value === 1;
}

function normalizeGrade(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function gradeNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function gradeAllowed(eligibleGrades, learnerGrade) {
  const grades = normalizeList(eligibleGrades);
  if (grades.length === 0) return true;
  const learnerText = normalizeGrade(learnerGrade);
  const learnerNumber = gradeNumber(learnerGrade);
  return grades.some((grade) => {
    if (normalizeGrade(grade) === learnerText) return true;
    const currentNumber = gradeNumber(grade);
    return (
      currentNumber !== null &&
      learnerNumber !== null &&
      currentNumber === learnerNumber
    );
  });
}

function normalizeCategory(value) {
  const category = String(value || "quiz").toLowerCase();
  return QUIZ_CATEGORIES.has(category) ? category : "quiz";
}

function dateBoundary(value, endOfDay = false) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
  }
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeAvailability(test, now = new Date()) {
  if (!normalizeBoolean(test.is_published)) {
    return { effective_is_published: false, effective_is_open: false };
  }
  if (test.quiz_type !== "weekly") {
    return { effective_is_published: true, effective_is_open: true };
  }
  const weekStart = dateBoundary(test.week_start_date);
  const termEnd = dateBoundary(test.term_end_date, true);
  if (!weekStart || !termEnd) {
    return { effective_is_published: true, effective_is_open: false };
  }
  return {
    effective_is_published: true,
    effective_is_open:
      normalizeBoolean(test.is_open) && now >= weekStart && now <= termEnd,
  };
}

function validateQuestionAllocation(data = {}) {
  const totalPoints = Number(data.total_points ?? 0);
  const allocated = (data.questions || []).reduce((sum, question) => {
    const points = Number(question.points ?? 1);
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("Each quiz question must have valid non-negative marks.");
    }
    return sum + points;
  }, 0);
  if (!Number.isFinite(totalPoints) || totalPoints < 0) {
    throw new Error("Quiz total marks must be a valid non-negative number.");
  }
  if (allocated > totalPoints) {
    throw new Error(
      `Question marks total ${allocated}, which exceeds the quiz total of ${totalPoints}.`,
    );
  }
}

async function getLearnerForUser(userId) {
  const result = await query(
    `SELECT id, school_id, grade, stream, full_name
     FROM learners
     WHERE user_id = $1::integer
       AND is_active = true
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function listTests(user, filters = {}) {
  const values = [];
  let where = "WHERE 1=1";

  const period = await resolveAssessmentScope(user, filters);
  if (!period) return [];
  values.push(period.term, period.academicYear);
  where += " AND qt.term = $1 AND qt.academic_year = $2";

  if (filters.quiz_type) {
    values.push(filters.quiz_type);
    where += ` AND qt.quiz_type = $${values.length}`;
  }
  if (filters.week_number) {
    values.push(Number(filters.week_number));
    where += ` AND qt.week_number = $${values.length}`;
  }
  if (filters.competition_id) {
    values.push(Number(filters.competition_id));
    where += ` AND qt.competition_id = $${values.length}`;
  }
  if (filters.id) {
    values.push(Number(filters.id));
    where += ` AND qt.id = $${values.length}`;
  }

  let learner = null;
  if (user.role === "learner") {
    learner = await getLearnerForUser(user.userId);
    if (!learner) return [];
    values.push(learner.school_id);
    where += ` AND (qt.school_id IS NULL OR qt.school_id = $${values.length})`;
  } else if (user.role === "school_admin" || user.role === "teacher") {
    values.push(user.schoolId);
    where += ` AND (qt.school_id IS NULL OR qt.school_id = $${values.length})`;
  }

  const result = await query(
    `SELECT qt.*,
            schedule.term_start_date,
            schedule.term_end_date,
            schedule.week_start_date,
            schedule.week_end_date,
            COUNT(qq.id)::integer AS question_count
     FROM quiz_tests qt
     LEFT JOIN LATERAL (
       SELECT t.start_date AS term_start_date,
              t.end_date AS term_end_date,
              tw.start_date AS week_start_date,
              tw.end_date AS week_end_date
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN term_weeks tw ON tw.term_id = t.id AND tw.week_number = qt.week_number
       WHERE t.name = qt.term
         AND ay.year = qt.academic_year
       ORDER BY t.is_active DESC, t.id DESC
       LIMIT 1
     ) schedule ON true
     LEFT JOIN quiz_test_questions qq ON qq.quiz_test_id = qt.id
     ${where}
     GROUP BY qt.id, schedule.term_start_date, schedule.term_end_date, schedule.week_start_date, schedule.week_end_date
     ORDER BY qt.academic_year DESC NULLS LAST, qt.week_number DESC NULLS LAST, qt.created_at DESC`,
    values,
  );

  let rows = result.rows.map((row) => ({
    ...row,
    ...computeAvailability(row),
  }));
  if (user.role === "learner") {
    rows = rows.filter(
      (row) =>
        row.effective_is_published &&
        row.effective_is_open &&
        gradeAllowed(row.eligible_grades, learner?.grade),
    );
  }
  return rows;
}

async function saveQuestions(testId, questions = []) {
  await query(
    "DELETE FROM quiz_test_questions WHERE quiz_test_id = $1::integer",
    [testId],
  );
  for (const [index, question] of questions.entries()) {
    await query(
      `INSERT INTO quiz_test_questions (
         quiz_test_id, position, question_type, prompt, image_url, options, correct_answer, points
       )
       VALUES (
         $1::integer, $2::integer, $3::varchar, $4::text, $5::text,
         $6::jsonb, $7::jsonb, $8::numeric
       )`,
      [
        testId,
        Number(question.position || index + 1),
        question.question_type || "single_choice",
        question.prompt || "",
        question.image_url || "",
        JSON.stringify(normalizeList(question.options)),
        JSON.stringify(question.correct_answer ?? ""),
        Number(question.points ?? 1),
      ],
    );
  }
}

// The caller's own role decides what comes back. This used to look the quiz up
// as a system administrator for every non-learner, which handed a school admin
// any other school's quiz - answer key included - from /tests/:id.
async function getTest(testId, user, filters = {}) {
  const tests = await listTests(user, { ...filters, id: testId });
  const base = tests.find((test) => Number(test.id) === Number(testId));
  if (!base) return null;

  const questions = await query(
    `SELECT *
     FROM quiz_test_questions
     WHERE quiz_test_id = $1::integer
     ORDER BY position`,
    [testId],
  );
  const includeAnswers = user.role !== "learner";
  return {
    ...base,
    ...computeAvailability(base),
    questions: questions.rows.map((question) => ({
      ...question,
      options: Array.isArray(question.options) ? question.options : [],
      correct_answer: includeAnswers ? question.correct_answer : undefined,
      points: Number(question.points || 0),
    })),
  };
}

async function getTestRow(testId) {
  const result = await query(
    "SELECT * FROM quiz_tests WHERE id = $1::integer",
    [testId],
  );
  return result.rows[0] || null;
}

async function createTest(user, data) {
  validateQuestionAllocation(data);
  const period = await requireConfiguredAssessmentScope(data);
  const quizType = resolveAssessmentType(user, data.quiz_type);
  const schoolId = resolveAssessmentSchoolId(user);
  const result = await query(
    `INSERT INTO quiz_tests (
       name, description, term, academic_year, week_number, quiz_type, competition_id,
       school_id, quiz_category, eligible_grades, eligible_streams, pass_score,
       max_attempts, duration_seconds, total_points, is_published, is_open, created_by_user_id
     )
     VALUES (
       $1::varchar, $2::text, NULLIF($3::text, ''), NULLIF($4::text, '')::integer,
       NULLIF($5::text, '')::integer, $6::varchar, NULLIF($7::text, '')::integer,
       NULLIF($8::text, '')::integer, $9::varchar, $10::jsonb, $11::jsonb,
       $12::numeric, $13::integer, $14::integer, $15::numeric, $16::boolean, $17::boolean,
       NULLIF($18::text, '')::integer
     )
     RETURNING *`,
    [
      data.name,
      data.description || "",
      period.term,
      period.academicYear,
      data.week_number || "",
      quizType,
      quizType === "competition" ? data.competition_id || "" : "",
      schoolId === null ? "" : String(schoolId),
      normalizeCategory(data.quiz_category),
      JSON.stringify(normalizeList(data.eligible_grades)),
      JSON.stringify(normalizeList(data.eligible_streams)),
      Number(data.pass_score || 50),
      Number(data.max_attempts || 1),
      Number(data.duration_seconds || 600),
      Number(data.total_points ?? 0),
      Boolean(data.is_published),
      Boolean(data.is_open),
      user.userId ? String(user.userId) : "",
    ],
  );
  await saveQuestions(result.rows[0].id, data.questions || []);
  return getTest(result.rows[0].id, user, {
    term: period.term,
    academic_year: period.academicYear,
  });
}

async function updateTest(user, testId, data) {
  const existing = await getTestRow(testId);
  if (!existing) return null;
  assertAssessmentManageAccess(user, existing, "quiz");

  validateQuestionAllocation(data);
  const period = await requireConfiguredAssessmentScope(data);
  const quizType = resolveAssessmentType(user, data.quiz_type);
  const schoolId = resolveAssessmentSchoolId(user);
  const result = await query(
    `UPDATE quiz_tests
     SET name = $1::varchar,
         description = $2::text,
         term = NULLIF($3::text, ''),
         academic_year = NULLIF($4::text, '')::integer,
         week_number = NULLIF($5::text, '')::integer,
         quiz_type = $6::varchar,
         competition_id = NULLIF($7::text, '')::integer,
         school_id = NULLIF($8::text, '')::integer,
         quiz_category = $9::varchar,
         eligible_grades = $10::jsonb,
         eligible_streams = $11::jsonb,
         pass_score = $12::numeric,
         max_attempts = $13::integer,
         duration_seconds = $14::integer,
         total_points = $15::numeric,
         is_published = $16::boolean,
         is_open = $17::boolean,
         updated_at = NOW()
     WHERE id = $18::integer
     RETURNING *`,
    [
      data.name,
      data.description || "",
      period.term,
      period.academicYear,
      data.week_number || "",
      quizType,
      quizType === "competition" ? data.competition_id || "" : "",
      schoolId === null ? "" : String(schoolId),
      normalizeCategory(data.quiz_category),
      JSON.stringify(normalizeList(data.eligible_grades)),
      JSON.stringify(normalizeList(data.eligible_streams)),
      Number(data.pass_score || 50),
      Number(data.max_attempts || 1),
      Number(data.duration_seconds || 600),
      Number(data.total_points ?? 0),
      Boolean(data.is_published),
      Boolean(data.is_open),
      testId,
    ],
  );
  if (!result.rows[0]) return null;
  await saveQuestions(testId, data.questions || []);
  return getTest(testId, user, {
    term: period.term,
    academic_year: period.academicYear,
  });
}

async function duplicateTest(user, testId) {
  const existing = await getTestRow(testId);
  if (!existing) return null;
  assertAssessmentManageAccess(user, existing, "quiz");

  const source = await getTest(testId, user, {
    term: existing.term,
    academic_year: existing.academic_year,
  });
  if (!source) return null;
  return createTest(user, {
    ...source,
    name: `${source.name} Copy`,
    is_published: false,
    is_open: false,
    questions: source.questions,
  });
}

async function deleteTest(user, testId) {
  const existing = await getTestRow(testId);
  if (!existing) return null;
  assertAssessmentManageAccess(user, existing, "quiz");

  const result = await query(
    "DELETE FROM quiz_tests WHERE id = $1::integer RETURNING *",
    [testId],
  );
  return result.rows[0] || null;
}

async function submitAttempt(user, testId, data = {}) {
  const learner = await getLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile not found.");
  const test = await getTest(testId, user);
  if (!test) throw new Error("Quiz is not available.");

  const attemptCount = await query(
    `SELECT COUNT(*)::integer AS count
     FROM quiz_test_attempts
     WHERE quiz_test_id = $1::integer
       AND learner_id = $2::integer`,
    [testId, learner.id],
  );
  const nextAttempt = Number(attemptCount.rows[0]?.count || 0) + 1;
  if (nextAttempt > Number(test.max_attempts || 1)) {
    throw new Error("Maximum quiz attempts reached.");
  }

  const fullQuestions = await query(
    `SELECT *
     FROM quiz_test_questions
     WHERE quiz_test_id = $1::integer
     ORDER BY position`,
    [testId],
  );
  const answers = data.answers || {};
  let earned = 0;
  let total = 0;
  const feedback = {};
  fullQuestions.rows.forEach((question) => {
    const points = Number(question.points || 0);
    total += points;
    const answer = answers[question.id] ?? answers[question.position];
    const correct = answersMatch(
      question.correct_answer,
      answer,
      question.question_type,
    );
    if (correct) earned += points;
    feedback[question.id] = {
      correct,
      points: correct ? points : 0,
      max_points: points,
    };
  });
  const score = total ? Math.round((earned / total) * 100) : 0;

  const attempt = await query(
    `INSERT INTO quiz_test_attempts (
       quiz_test_id, learner_id, attempt_number, answers, score,
       earned_points, total_points, feedback, duration_seconds
     )
     VALUES (
       $1::integer, $2::integer, $3::integer, $4::jsonb, $5::numeric,
       $6::numeric, $7::numeric, $8::jsonb, NULLIF($9::text, '')::integer
     )
     RETURNING *`,
    [
      testId,
      learner.id,
      nextAttempt,
      JSON.stringify(answers),
      score,
      earned,
      total,
      JSON.stringify(feedback),
      data.duration_seconds || "",
    ],
  );

  if (
    test.quiz_type === "weekly" &&
    test.term &&
    test.academic_year &&
    test.week_number
  ) {
    const weeklyMark = await query(
      `INSERT INTO weekly_marks (learner_id, week_number, term, academic_year, quiz_score)
       VALUES ($1::integer, $2::integer, $3::varchar, $4::integer, $5::integer)
       ON CONFLICT (learner_id, week_number, term, academic_year)
       DO UPDATE SET quiz_score = GREATEST(COALESCE(weekly_marks.quiz_score, 0), EXCLUDED.quiz_score),
                     updated_at = NOW()
       RETURNING *`,
      [learner.id, test.week_number, test.term, test.academic_year, score],
    );
    attempt.rows[0].weekly_mark = weeklyMark.rows[0] || null;
  }

  if (test.quiz_type === "competition" && test.competition_id) {
    await query(
      `INSERT INTO competition_results (
         competition_id, learner_id, result_stage, learner_grade, competition_type,
         quiz_score, total_score, source, last_synced_at
       )
       VALUES ($1::integer, $2::integer, 'final', $3::varchar, $4::varchar, $5::numeric, $5::numeric, 'educlub_quiz', NOW())
       ON CONFLICT (competition_id, learner_id, result_stage)
       DO UPDATE SET quiz_score = GREATEST(COALESCE(competition_results.quiz_score, 0), EXCLUDED.quiz_score),
                     total_score = GREATEST(COALESCE(competition_results.total_score, 0), EXCLUDED.total_score),
                     source = 'educlub_quiz',
                     last_synced_at = NOW()`,
      [
        test.competition_id,
        learner.id,
        learner.grade || "",
        test.quiz_category || "quiz",
        score,
      ],
    );
  }

  return {
    attempt: attempt.rows[0],
    score,
    earned_points: earned,
    total_points: total,
    feedback,
  };
}

async function getReport(user, filters = {}) {
  const period = await resolveAssessmentScope(user, filters);
  if (!period) return [];
  const values = [period.term, period.academicYear];
  let where = "WHERE qt.quiz_type = 'weekly' AND qt.term = $1 AND qt.academic_year = $2";
  if (filters.week_number) {
    values.push(Number(filters.week_number));
    where += ` AND qt.week_number = $${values.length}`;
  }
  if (user.role === "school_admin" || user.role === "teacher") {
    values.push(user.schoolId);
    where += ` AND l.school_id = $${values.length}`;
  }
  const result = await query(
    `SELECT l.id AS learner_id, l.full_name, l.grade, l.stream, s.name AS school_name,
            qt.id AS test_id, qt.name AS test_name, qt.week_number, qt.pass_score,
            MAX(qta.score) AS final_score,
            MAX(wm.quiz_score) AS cached_quiz_score
     FROM quiz_tests qt
     JOIN learners l ON (qt.school_id IS NULL OR qt.school_id = l.school_id)
     JOIN schools s ON s.id = l.school_id
     LEFT JOIN quiz_test_attempts qta ON qta.quiz_test_id = qt.id AND qta.learner_id = l.id
     LEFT JOIN weekly_marks wm
       ON wm.learner_id = l.id
      AND wm.term = qt.term
      AND wm.academic_year = qt.academic_year
      AND wm.week_number = qt.week_number
     ${where}
     GROUP BY l.id, l.full_name, l.grade, l.stream, s.name, qt.id, qt.name, qt.week_number, qt.pass_score
     ORDER BY qt.week_number, l.grade, l.stream, l.full_name`,
    values,
  );
  return result.rows.map((row) => ({
    ...row,
    final_score:
      row.final_score === null || row.final_score === undefined
        ? row.cached_quiz_score === null || row.cached_quiz_score === undefined
          ? null
          : Number(row.cached_quiz_score)
        : Number(row.final_score),
  }));
}

async function getAttemptReview(user, testId, filters = {}) {
  const period = await resolveAssessmentScope(user, filters);
  if (!period) return null;
  const values = [Number(testId), period.term, period.academicYear];
  let testScope = "";
  let learnerScope = "";

  if (user.role === "school_admin" || user.role === "teacher") {
    values.push(Number(user.schoolId));
    testScope = ` AND (qt.school_id IS NULL OR qt.school_id = $${values.length}::integer)`;
    learnerScope = ` AND l.school_id = $${values.length}::integer`;
  }

  const testResult = await query(
    `SELECT qt.*
     FROM quiz_tests qt
     WHERE qt.id = $1::integer
       AND qt.term = $2::varchar
       AND qt.academic_year = $3::integer
       ${testScope}
     LIMIT 1`,
    values,
  );
  const test = testResult.rows[0];
  if (!test) return null;

  const questions = await query(
    `SELECT id, position, question_type, prompt, image_url, options, correct_answer, points
     FROM quiz_test_questions
     WHERE quiz_test_id = $1::integer
     ORDER BY position`,
    [testId],
  );
  const attempts = await query(
    `SELECT qta.id,
            qta.attempt_number,
            qta.answers,
            qta.score,
            qta.earned_points,
            qta.total_points,
            qta.feedback,
            qta.duration_seconds,
            qta.submitted_at,
            l.full_name,
            l.grade,
            l.stream
     FROM quiz_test_attempts qta
     JOIN learners l ON l.id = qta.learner_id
     WHERE qta.quiz_test_id = $1::integer
       ${learnerScope}
     ORDER BY l.full_name, qta.attempt_number DESC`,
    values,
  );

  return {
    test: {
      ...test,
      questions: questions.rows.map((question) => ({
        ...question,
        points: Number(question.points || 0),
      })),
    },
    attempts: attempts.rows.map((attempt) => ({
      ...attempt,
      score: Number(attempt.score || 0),
      earned_points: Number(attempt.earned_points || 0),
      total_points: Number(attempt.total_points || 0),
    })),
  };
}

async function updateAttemptMarks(user, attemptId, data = {}, filters = {}) {
  const period = await resolveAssessmentScope(user, filters);
  if (!period) return null;
  const values = [Number(attemptId), period.term, period.academicYear];
  let scope = "";
  if (user.role === "school_admin" || user.role === "teacher") {
    values.push(Number(user.schoolId));
    scope = ` AND l.school_id = $${values.length}::integer
              AND (qt.school_id IS NULL OR qt.school_id = $${values.length}::integer)`;
  }

  const result = await query(
    `SELECT qta.*, l.school_id, qt.quiz_type, qt.term, qt.academic_year,
            qt.week_number
     FROM quiz_test_attempts qta
     JOIN learners l ON l.id = qta.learner_id
     JOIN quiz_tests qt ON qt.id = qta.quiz_test_id
     WHERE qta.id = $1::integer
       AND qt.term = $2::varchar
       AND qt.academic_year = $3::integer
       ${scope}
     LIMIT 1`,
    values,
  );
  const existing = result.rows[0];
  if (!existing) return null;

  const questions = await query(
    `SELECT id, points
     FROM quiz_test_questions
     WHERE quiz_test_id = $1::integer
     ORDER BY position`,
    [existing.quiz_test_id],
  );
  const marks = normalizeQuestionMarks(questions.rows, data.question_marks || {});
  const updated = await query(
    `UPDATE quiz_test_attempts
     SET earned_points = $2::numeric,
         total_points = $3::numeric,
         score = $4::numeric,
         feedback = $5::jsonb
     WHERE id = $1::integer
     RETURNING *`,
    [
      attemptId,
      marks.earnedPoints,
      marks.totalPoints,
      marks.score,
      JSON.stringify(marks.feedback),
    ],
  );

  if (
    existing.quiz_type === "weekly" &&
    existing.term &&
    existing.academic_year &&
    existing.week_number
  ) {
    const best = await query(
      `SELECT MAX(qta.score)::numeric AS score
       FROM quiz_test_attempts qta
       JOIN quiz_tests qt ON qt.id = qta.quiz_test_id
       WHERE qta.learner_id = $1::integer
         AND qt.quiz_type = 'weekly'
         AND qt.term = $2::varchar
         AND qt.academic_year = $3::integer
         AND qt.week_number = $4::integer`,
      [
        existing.learner_id,
        existing.term,
        existing.academic_year,
        existing.week_number,
      ],
    );
    await query(
      `INSERT INTO weekly_marks (
         learner_id, week_number, term, academic_year, quiz_score
       )
       VALUES ($1::integer, $2::integer, $3::varchar, $4::integer, $5::numeric)
       ON CONFLICT (learner_id, week_number, term, academic_year)
       DO UPDATE SET quiz_score = EXCLUDED.quiz_score, updated_at = NOW()`,
      [
        existing.learner_id,
        existing.week_number,
        existing.term,
        existing.academic_year,
        Number(best.rows[0]?.score || 0),
      ],
    );
  }

  return {
    ...updated.rows[0],
    score: marks.score,
    earned_points: marks.earnedPoints,
    total_points: marks.totalPoints,
    feedback: marks.feedback,
  };
}

module.exports = {
  listTests,
  getTest,
  createTest,
  updateTest,
  duplicateTest,
  deleteTest,
  submitAttempt,
  getReport,
  getAttemptReview,
  updateAttemptMarks,
};
