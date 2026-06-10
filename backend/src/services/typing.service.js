const { query } = require("../config");

function normalizeList(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value.map((item) => String(item || "").trim()).filter(Boolean)
      ),
    ];
  }
  return [];
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function dateBoundary(value, endOfDay = false) {
  if (value instanceof Date && isValidDate(value)) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
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
    endOfDay ? 999 : 0
  );
  return isValidDate(date) ? date : null;
}

function computeAvailability(test, now = new Date()) {
  const storedPublished = normalizeBoolean(test.is_published);
  const storedOpen = normalizeBoolean(test.is_open);

  if (!storedPublished) {
    return {
      effective_is_published: false,
      effective_is_open: false,
      availability_mode: "manual",
    };
  }

  if (test.test_type !== "weekly") {
    return {
      effective_is_published: true,
      effective_is_open: true,
      availability_mode: "manual",
    };
  }

  const weekStart = dateBoundary(test.week_start_date);
  const termEnd = dateBoundary(test.term_end_date, true);

  if (!weekStart || !termEnd) {
    return {
      effective_is_published: true,
      effective_is_open: false,
      availability_mode: "schedule_missing",
    };
  }

  if (now < weekStart) {
    return {
      effective_is_published: true,
      effective_is_open: false,
      availability_mode: "upcoming",
    };
  }

  if (now > termEnd) {
    return {
      effective_is_published: true,
      effective_is_open: false,
      availability_mode: "term_closed",
    };
  }

  return {
    effective_is_published: true,
    effective_is_open: storedOpen,
    availability_mode: "scheduled",
  };
}

function sortTests(tests = []) {
  return [...tests].sort((left, right) => {
    const leftOpen = left.effective_is_open ? 1 : 0;
    const rightOpen = right.effective_is_open ? 1 : 0;
    if (leftOpen !== rightOpen) {
      return rightOpen - leftOpen;
    }

    const leftYear = Number(left.academic_year || 0);
    const rightYear = Number(right.academic_year || 0);
    if (leftYear !== rightYear) {
      return rightYear - leftYear;
    }

    const leftWeek = Number(left.week_number || 0);
    const rightWeek = Number(right.week_number || 0);
    if (leftWeek !== rightWeek) {
      return rightWeek - leftWeek;
    }

    return new Date(right.created_at || 0) - new Date(left.created_at || 0);
  });
}

function tokenizeWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTypingAttempt(passage, typedText, durationSeconds) {
  const expected = String(passage || "");
  const typed = String(typedText || "").slice(0, expected.length || undefined);
  const seconds = Math.max(1, Number(durationSeconds) || 1);
  const minutes = seconds / 60;
  const typedCharacters = typed.length;
  const grossWpm = typedCharacters / 5 / minutes;

  const expectedWords = tokenizeWords(expected);
  const typedWords = tokenizeWords(typed);
  const totalWords = Math.max(typedWords.length, 1);
  let errors = 0;

  for (let index = 0; index < typedWords.length; index += 1) {
    const expectedWord = expectedWords[index] || "";
    const typedWord = typedWords[index] || "";
    if (typedWord !== expectedWord) {
      errors += 1;
    }
  }

  const accuracy = Math.max(0, ((totalWords - errors) / totalWords) * 100);
  const errorsPerMinute = errors / minutes;
  const finalScore = Math.max(0, grossWpm - errorsPerMinute);

  return {
    raw_wpm: Number(grossWpm.toFixed(2)),
    accuracy: Number(Math.max(0, Math.min(100, accuracy)).toFixed(2)),
    mistakes: errors,
    final_score: Number(finalScore.toFixed(2)),
  };
}

async function getBestCompletedTrial(testId, learnerId) {
  const lessonCountResult = await query(
    "SELECT COUNT(*)::int AS count FROM typing_lessons WHERE typing_test_id = $1",
    [testId]
  );
  const lessonCount = lessonCountResult.rows[0]?.count || 0;
  if (!lessonCount) return null;

  const result = await query(
    `SELECT attempt_number,
            COUNT(DISTINCT typing_lesson_id)::int AS completed_lessons,
            ROUND(AVG(final_score), 2) AS average_net_wpm,
            ROUND(AVG(raw_wpm), 2) AS average_raw_wpm,
            ROUND(AVG(accuracy), 2) AS average_accuracy,
            SUM(mistakes)::int AS total_errors
     FROM typing_attempts
     WHERE typing_test_id = $1
       AND learner_id = $2
     GROUP BY attempt_number
     HAVING COUNT(DISTINCT typing_lesson_id) = $3
     ORDER BY average_net_wpm DESC, attempt_number ASC`,
    [testId, learnerId, lessonCount]
  );

  return result.rows[0] || null;
}

async function getLearnerForUser(userId) {
  const result = await query(
    `SELECT id, school_id, grade, stream, full_name
     FROM learners
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function listTests(user, filters = {}) {
  const values = [];
  let where = "WHERE 1=1";

  if (filters.test_type) {
    values.push(filters.test_type);
    where += ` AND tt.test_type = $${values.length}`;
  }

  if (filters.term) {
    values.push(filters.term);
    where += ` AND tt.term = $${values.length}`;
  }

  if (filters.academic_year) {
    values.push(Number(filters.academic_year));
    where += ` AND tt.academic_year = $${values.length}`;
  }

  if (filters.week_number) {
    values.push(Number(filters.week_number));
    where += ` AND tt.week_number = $${values.length}`;
  }

  if (user.role === "learner") {
    const learner = await getLearnerForUser(user.userId);
    if (!learner) return [];
    values.push(learner.school_id);
    where += ` AND (tt.school_id IS NULL OR tt.school_id = $${values.length})`;
  } else if (user.role === "school_admin" || user.role === "teacher") {
    values.push(user.schoolId);
    where += ` AND (tt.school_id IS NULL OR tt.school_id = $${values.length})`;
  }

  const result = await query(
    `SELECT tt.*,
            schedule.term_start_date,
            schedule.term_end_date,
            schedule.week_start_date,
            schedule.week_end_date,
            COUNT(tl.id)::int AS lesson_count
     FROM typing_tests tt
     LEFT JOIN LATERAL (
       SELECT t.start_date AS term_start_date,
              t.end_date AS term_end_date,
              tw.start_date AS week_start_date,
              tw.end_date AS week_end_date
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN term_weeks tw ON tw.term_id = t.id AND tw.week_number = tt.week_number
       WHERE t.name = tt.term
         AND ay.year = tt.academic_year
       ORDER BY t.is_active DESC, t.id DESC
       LIMIT 1
     ) schedule ON true
     LEFT JOIN typing_lessons tl ON tl.typing_test_id = tt.id
     ${where}
     GROUP BY tt.id, schedule.term_start_date, schedule.term_end_date, schedule.week_start_date, schedule.week_end_date`,
    values
  );

  const decorated = result.rows.map((row) => ({
    ...row,
    ...computeAvailability(row),
  }));

  let filtered = decorated;
  if (user.role === "learner") {
    const learner = await getLearnerForUser(user.userId);
    filtered = decorated.filter(
      (row) =>
        row.effective_is_published &&
        row.effective_is_open &&
        gradeAllowed(row.eligible_grades, learner?.grade)
    );
  }

  return sortTests(filtered);
}

async function getTest(testId, user) {
  const result = await query(
    `SELECT tt.*,
            schedule.term_start_date,
            schedule.term_end_date,
            schedule.week_start_date,
            schedule.week_end_date,
            COUNT(tl.id)::int AS lesson_count
     FROM typing_tests tt
     LEFT JOIN LATERAL (
       SELECT t.start_date AS term_start_date,
              t.end_date AS term_end_date,
              tw.start_date AS week_start_date,
              tw.end_date AS week_end_date
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN term_weeks tw ON tw.term_id = t.id AND tw.week_number = tt.week_number
       WHERE t.name = tt.term
         AND ay.year = tt.academic_year
       ORDER BY t.is_active DESC, t.id DESC
       LIMIT 1
     ) schedule ON true
     LEFT JOIN typing_lessons tl ON tl.typing_test_id = tt.id
     WHERE tt.id = $1
     GROUP BY tt.id, schedule.term_start_date, schedule.term_end_date, schedule.week_start_date, schedule.week_end_date`,
    [testId]
  );
  const rawTest = result.rows[0];
  if (!rawTest) return null;

  const allowed = {
    ...rawTest,
    ...computeAvailability(rawTest),
  };

  if (user.role === "learner") {
    const learner = await getLearnerForUser(user.userId);
    if (!learner) return null;

    const schoolAllowed =
      !allowed.school_id || Number(allowed.school_id) === Number(learner.school_id);

    if (allowed.test_type === "competition" && allowed.competition_id) {
      const enrollment = await query(
        `SELECT ce.id
         FROM competition_enrollments ce
         JOIN competitions c ON c.id = ce.competition_id
         WHERE ce.competition_id = $1
           AND ce.learner_id = $2
           AND ce.status = 'enrolled'
           AND c.competition_type = 'typing'
         LIMIT 1`,
        [allowed.competition_id, learner.id]
      );
      if (!enrollment.rows[0]) {
        return null;
      }
    } else if (
      !schoolAllowed ||
      !gradeAllowed(allowed.eligible_grades, learner.grade) ||
      !allowed.effective_is_published ||
      !allowed.effective_is_open
    ) {
      return null;
    }
  } else if (user.role === "school_admin" || user.role === "teacher") {
    if (allowed.school_id && Number(allowed.school_id) !== Number(user.schoolId)) {
      return null;
    }
  }

  const lessons = await query(
    `SELECT *
     FROM typing_lessons
     WHERE typing_test_id = $1
     ORDER BY lesson_order`,
    [testId]
  );

  let attempts = [];
  let resume = null;
  if (user.role === "learner") {
    const learner = await getLearnerForUser(user.userId);
    if (learner) {
      const result = await query(
        `SELECT *
         FROM typing_attempts
         WHERE typing_test_id = $1 AND learner_id = $2
         ORDER BY typing_lesson_id, attempt_number`,
        [testId, learner.id]
      );
      attempts = result.rows;
      const trialState = await resolveTrialState(testId, learner.id, allowed.max_attempts);
      const currentTrialLessons =
        trialState.trials.get(trialState.currentTrialNumber) || new Set();
      const nextLessonIndex = lessons.rows.findIndex(
        (lesson) => !currentTrialLessons.has(lesson.id)
      );
      resume = {
        current_trial_number: trialState.currentTrialNumber,
        completed_trials: trialState.completedTrials,
        next_lesson_index: nextLessonIndex === -1 ? 0 : nextLessonIndex,
        has_in_progress_trial: Boolean(trialState.inProgressTrial),
      };
    }
  }

  return { ...allowed, lessons: lessons.rows, attempts, resume };
}

async function saveLessons(testId, lessons = [], defaultDuration) {
  const existingResult = await query(
    `SELECT tl.*,
            EXISTS (
              SELECT 1 FROM typing_attempts ta
              WHERE ta.typing_lesson_id = tl.id
              LIMIT 1
            ) AS has_attempts
     FROM typing_lessons tl
     WHERE tl.typing_test_id = $1
     ORDER BY tl.lesson_order, tl.id`,
    [testId]
  );
  const existingById = new Map(
    existingResult.rows.map((lesson) => [Number(lesson.id), lesson])
  );
  const existingByOrder = new Map(
    existingResult.rows.map((lesson) => [Number(lesson.lesson_order), lesson])
  );
  const keptIds = new Set();

  for (const [index, lesson] of lessons.entries()) {
    const lessonOrder = Number(lesson.lesson_order || index + 1);
    const existing =
      existingById.get(Number(lesson.id)) || existingByOrder.get(lessonOrder);
    const values = [
      lessonOrder,
      cleanText(lesson.title) || `Lesson ${index + 1}`,
      String(lesson.passage || "").trim(),
      String(lesson.instructions || "").trim(),
      Number(lesson.duration_seconds || defaultDuration || 300),
    ];

    if (existing) {
      keptIds.add(Number(existing.id));
      await query(
        `UPDATE typing_lessons
         SET lesson_order = $1,
             title = $2,
             passage = $3,
             instructions = $4,
             duration_seconds = $5
         WHERE id = $6 AND typing_test_id = $7`,
        [...values, existing.id, testId]
      );
      continue;
    }

    await query(
      `INSERT INTO typing_lessons (
         typing_test_id, lesson_order, title, passage, instructions, duration_seconds
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        testId,
        ...values,
      ]
    );
  }

  const removableIds = existingResult.rows
    .filter((lesson) => !keptIds.has(Number(lesson.id)) && !lesson.has_attempts)
    .map((lesson) => lesson.id);
  if (removableIds.length > 0) {
    await query(
      "DELETE FROM typing_lessons WHERE typing_test_id = $1 AND id = ANY($2::int[])",
      [testId, removableIds]
    );
  }
}

async function createTest(user, data) {
  const testType = data.test_type === "competition" ? "competition" : "weekly";
  const result = await query(
    `INSERT INTO typing_tests (
       name, description, term, academic_year, week_number, test_type, competition_id,
       school_id, eligible_grades, eligible_streams, pass_threshold,
       allow_reattempts, max_attempts, duration_seconds, deadline_at,
       is_published, is_open, created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      cleanText(data.name),
      data.description || null,
      data.term || null,
      data.academic_year ? Number(data.academic_year) : null,
      data.week_number ? Number(data.week_number) : null,
      testType,
      data.competition_id || null,
      data.school_id || null,
      JSON.stringify(normalizeList(data.eligible_grades)),
      JSON.stringify(normalizeList(data.eligible_streams)),
      Number(data.pass_threshold || 25),
      data.allow_reattempts !== false,
      Number(data.max_attempts || 3),
      Number(data.duration_seconds || 300),
      data.deadline_at || null,
      Boolean(data.is_published),
      Boolean(data.is_open),
      user.userId,
    ]
  );
  await saveLessons(
    result.rows[0].id,
    data.lessons || [],
    data.duration_seconds
  );
  return getTest(result.rows[0].id, user);
}

async function updateTest(user, testId, data) {
  const testType = data.test_type === "competition" ? "competition" : "weekly";
  const result = await query(
    `UPDATE typing_tests
     SET name = $1,
         description = $2,
         term = $3,
         academic_year = $4,
         week_number = $5,
         test_type = $6,
         competition_id = $7,
         school_id = $8,
         eligible_grades = $9::jsonb,
         eligible_streams = $10::jsonb,
         pass_threshold = $11,
         allow_reattempts = $12,
         max_attempts = $13,
         duration_seconds = $14,
         deadline_at = $15,
         is_published = $16,
         is_open = $17,
         updated_at = NOW()
     WHERE id = $18
     RETURNING *`,
    [
      cleanText(data.name),
      data.description || null,
      data.term || null,
      data.academic_year ? Number(data.academic_year) : null,
      data.week_number ? Number(data.week_number) : null,
      testType,
      data.competition_id || null,
      data.school_id || null,
      JSON.stringify(normalizeList(data.eligible_grades)),
      JSON.stringify(normalizeList(data.eligible_streams)),
      Number(data.pass_threshold || 25),
      data.allow_reattempts !== false,
      Number(data.max_attempts || 3),
      Number(data.duration_seconds || 300),
      data.deadline_at || null,
      Boolean(data.is_published),
      Boolean(data.is_open),
      testId,
    ]
  );
  if (!result.rows[0]) return null;
  await saveLessons(testId, data.lessons || [], data.duration_seconds);
  return getTest(testId, user);
}

async function duplicateTest(user, testId) {
  const source = await getTest(testId, { ...user, role: "system_admin" });
  if (!source) return null;
  return createTest(user, {
    ...source,
    name: `${source.name} Copy`,
    is_published: false,
    is_open: false,
    lessons: source.lessons,
  });
}

async function deleteTest(user, testId) {
  const allowed = await getTest(testId, { ...user, role: "system_admin" });
  if (!allowed) return null;

  if (
    allowed.test_type === "weekly" &&
    allowed.term &&
    allowed.academic_year &&
    allowed.week_number
  ) {
    await query(
      `UPDATE weekly_marks
       SET typing_score = NULL,
           updated_at = NOW()
       WHERE term = $1
         AND academic_year = $2
         AND week_number = $3`,
      [allowed.term, allowed.academic_year, allowed.week_number]
    );
  }

  if (allowed.test_type === "competition" && allowed.competition_id) {
    await query(
      `DELETE FROM competition_results
       WHERE competition_id = $1
         AND competition_type = 'typing'
         AND source = 'educlub_typing'`,
      [allowed.competition_id]
    );
  }

  const result = await query("DELETE FROM typing_tests WHERE id = $1 RETURNING *", [
    testId,
  ]);
  return result.rows[0] || null;
}

async function ensureLessonUnlocked(test, lesson, learnerId) {
  const priorLessons = test.lessons.filter(
    (item) => item.lesson_order < lesson.lesson_order
  );
  if (priorLessons.length === 0) return true;
  const priorIds = priorLessons.map((item) => item.id);
  const result = await query(
    `SELECT DISTINCT typing_lesson_id
     FROM typing_attempts
     WHERE learner_id = $1
       AND typing_lesson_id = ANY($2)
       AND final_score IS NOT NULL`,
    [learnerId, priorIds]
  );
  return result.rows.length === priorIds.length;
}

async function resolveTrialState(testId, learnerId, maxAttempts) {
  const lessonCountResult = await query(
    "SELECT COUNT(*)::int AS count FROM typing_lessons WHERE typing_test_id = $1",
    [testId]
  );
  const lessonCount = lessonCountResult.rows[0]?.count || 0;
  const attemptsResult = await query(
    `SELECT attempt_number,
            typing_lesson_id
     FROM typing_attempts
     WHERE typing_test_id = $1
       AND learner_id = $2
     ORDER BY attempt_number, typing_lesson_id`,
    [testId, learnerId]
  );

  const trials = new Map();
  for (const row of attemptsResult.rows) {
    const trial = trials.get(row.attempt_number) || new Set();
    trial.add(row.typing_lesson_id);
    trials.set(row.attempt_number, trial);
  }

  const completedTrials = [...trials.entries()].filter(
    ([, lessons]) => lessons.size >= lessonCount && lessonCount > 0
  ).length;
  const inProgressTrial = [...trials.entries()].find(
    ([, lessons]) => lessons.size > 0 && lessons.size < lessonCount
  );

  let currentTrialNumber = inProgressTrial ? Number(inProgressTrial[0]) : 0;
  if (!currentTrialNumber) {
    currentTrialNumber = trials.size > 0 ? Math.max(...trials.keys()) + 1 : 1;
  }

  return {
    lessonCount,
    trials,
    completedTrials,
    inProgressTrial: inProgressTrial ? Number(inProgressTrial[0]) : null,
    currentTrialNumber,
    maxAttempts: Number(maxAttempts || 1),
  };
}

async function submitAttempt(user, lessonId, data) {
  const learner = await getLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile not found.");

  const lessonResult = await query(
    `SELECT tl.*, tt.allow_reattempts, tt.max_attempts, tt.duration_seconds AS test_duration_seconds,
            tt.id AS test_id, tt.term, tt.academic_year, tt.week_number, tt.test_type,
            tt.competition_id, tt.pass_threshold
     FROM typing_lessons tl
     JOIN typing_tests tt ON tt.id = tl.typing_test_id
     WHERE tl.id = $1
       AND (tt.deadline_at IS NULL OR tt.deadline_at >= NOW())`,
    [lessonId]
  );
  const lesson = lessonResult.rows[0];
  if (!lesson) throw new Error("Typing lesson is not available.");

  const test = await getTest(lesson.test_id, user);
  if (!test) throw new Error("Typing test is not available to this learner.");
  if (!test.effective_is_published || !test.effective_is_open) {
    throw new Error(
      test.test_type === "weekly"
        ? "This typing lesson is not open for learners yet."
        : "This typing lesson is currently closed."
    );
  }
  if (!(await ensureLessonUnlocked(test, lesson, learner.id))) {
    throw new Error("Complete the previous lesson before starting this one.");
  }

  const trialState = await resolveTrialState(
    lesson.test_id,
    learner.id,
    lesson.max_attempts
  );

  if (!lesson.allow_reattempts && trialState.completedTrials > 0) {
    throw new Error("Reattempts are disabled for this test.");
  }
  if (
    !trialState.inProgressTrial &&
    trialState.completedTrials >= trialState.maxAttempts
  ) {
    throw new Error("Maximum attempts reached for this typing test.");
  }

  const attemptNumber = trialState.currentTrialNumber;
  const trialLessons = trialState.trials.get(attemptNumber) || new Set();
  if (trialLessons.has(Number(lessonId))) {
    throw new Error(
      "This lesson has already been completed in the current trial. Continue with the next lesson."
    );
  }

  const durationSeconds = Math.min(
    Number(
      data.duration_seconds ||
        lesson.duration_seconds ||
        lesson.test_duration_seconds ||
        300
    ),
    Number(lesson.duration_seconds || lesson.test_duration_seconds || 300)
  );
  const score = scoreTypingAttempt(
    lesson.passage,
    data.typed_text,
    durationSeconds
  );
  const result = await query(
    `INSERT INTO typing_attempts (
       typing_test_id, typing_lesson_id, learner_id, attempt_number, typed_text,
       raw_wpm, accuracy, mistakes, final_score, duration_seconds
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      lesson.test_id,
      lessonId,
      learner.id,
      attemptNumber,
      String(data.typed_text || ""),
      score.raw_wpm,
      score.accuracy,
      score.mistakes,
      score.final_score,
      durationSeconds,
    ]
  );

  await refreshAggregateScore(lesson.test_id, learner.id);
  return result.rows[0];
}

async function refreshAggregateScore(testId, learnerId) {
  const testResult = await query("SELECT * FROM typing_tests WHERE id = $1", [
    testId,
  ]);
  const test = testResult.rows[0];
  if (!test) return null;

  const bestTrial = await getBestCompletedTrial(testId, learnerId);
  if (!bestTrial) return null;
  const average = Number(bestTrial.average_net_wpm || 0);
  if (
    test.test_type === "weekly" &&
    test.term &&
    test.academic_year &&
    test.week_number
  ) {
    await query(
      `INSERT INTO weekly_marks (learner_id, week_number, term, academic_year, typing_score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (learner_id, week_number, term, academic_year)
       DO UPDATE SET typing_score = EXCLUDED.typing_score, updated_at = NOW()`,
      [learnerId, test.week_number, test.term, test.academic_year, average]
    );
  }

  if (test.test_type === "competition" && test.competition_id) {
    const learner = await query("SELECT grade FROM learners WHERE id = $1", [
      learnerId,
    ]);
    await query(
      `INSERT INTO competition_results (
         competition_id, learner_id, result_stage, learner_grade, competition_type,
         typing_wpm, typing_accuracy, total_score, source, last_synced_at
       )
       VALUES ($1, $2, 'final', $3, 'typing', $4, $5, $4, 'educlub_typing', NOW())
       ON CONFLICT (competition_id, learner_id, result_stage)
       DO UPDATE SET typing_wpm = EXCLUDED.typing_wpm,
                     typing_accuracy = EXCLUDED.typing_accuracy,
                     total_score = EXCLUDED.total_score,
                     source = 'educlub_typing',
                     last_synced_at = NOW()`,
      [
        test.competition_id,
        learnerId,
        learner.rows[0]?.grade || null,
        average,
        Number(bestTrial.average_accuracy || 0),
      ]
    );
  }

  return average;
}

async function getReport(user, filters = {}) {
  const values = [];
  let where = "WHERE tt.test_type = 'weekly'";
  if (filters.term) {
    values.push(filters.term);
    where += ` AND tt.term = $${values.length}`;
  }
  if (filters.academic_year) {
    values.push(Number(filters.academic_year));
    where += ` AND tt.academic_year = $${values.length}`;
  }
  if (filters.week_number) {
    values.push(Number(filters.week_number));
    where += ` AND tt.week_number = $${values.length}`;
  }
  if (filters.grade) {
    values.push(filters.grade);
    where += ` AND l.grade = $${values.length}`;
  }
  if (filters.stream) {
    values.push(filters.stream);
    where += ` AND l.stream = $${values.length}`;
  }
  if (user.role === "school_admin" || user.role === "teacher") {
    values.push(user.schoolId);
    where += ` AND l.school_id = $${values.length}`;
  } else if (filters.school_id) {
    values.push(Number(filters.school_id));
    where += ` AND l.school_id = $${values.length}`;
  }

  const result = await query(
    `SELECT l.id AS learner_id, l.full_name, l.grade, l.stream, s.name AS school_name,
            tt.id AS test_id, tt.name AS test_name, tt.week_number, tt.pass_threshold,
            tt.eligible_grades,
            COUNT(DISTINCT tl.id)::int AS lesson_count,
            COUNT(DISTINCT ta.typing_lesson_id)::int AS attempted_lessons,
            MAX(wm.typing_score) AS cached_typing_score
     FROM typing_tests tt
     JOIN typing_lessons tl ON tl.typing_test_id = tt.id
     JOIN learners l ON (
       (tt.school_id IS NULL OR tt.school_id = l.school_id)
     )
     JOIN schools s ON s.id = l.school_id
     LEFT JOIN typing_attempts ta
       ON ta.typing_test_id = tt.id
      AND ta.typing_lesson_id = tl.id
      AND ta.learner_id = l.id
     LEFT JOIN weekly_marks wm
       ON wm.learner_id = l.id
      AND wm.term = tt.term
      AND wm.academic_year = tt.academic_year
      AND wm.week_number = tt.week_number
     ${where}
     GROUP BY l.id, l.full_name, l.grade, l.stream, s.name, tt.id, tt.name, tt.week_number, tt.pass_threshold, tt.eligible_grades
     ORDER BY tt.week_number, l.grade, l.stream, l.full_name`,
    values
  );

  const rows = await Promise.all(
    result.rows.map(async (row) => {
      if (!gradeAllowed(row.eligible_grades, row.grade)) return null;
      const bestTrial = await getBestCompletedTrial(row.test_id, row.learner_id);
      const cachedScore =
        row.cached_typing_score === null || row.cached_typing_score === undefined
          ? null
          : Number(row.cached_typing_score);
      const finalScore = bestTrial
        ? Number(bestTrial.average_net_wpm || 0)
        : cachedScore;
      return {
        ...row,
        completed_lessons:
          bestTrial || cachedScore !== null ? row.lesson_count : row.attempted_lessons,
        final_score: finalScore,
        average_raw_wpm: bestTrial ? Number(bestTrial.average_raw_wpm || 0) : null,
        average_accuracy: bestTrial ? Number(bestTrial.average_accuracy || 0) : null,
        total_errors: bestTrial ? Number(bestTrial.total_errors || 0) : null,
        passed: finalScore === null ? false : finalScore >= Number(row.pass_threshold || 0),
      };
    })
  );

  return rows.filter(Boolean);
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
  scoreTypingAttempt,
};
