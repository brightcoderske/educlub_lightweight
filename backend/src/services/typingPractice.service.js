const { query } = require("../config");
const { scoreTypingAttempt } = require("./typingScoring");

function numberInRange(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanKey(value, fallback = "") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function getLearnerForUser(userId) {
  const result = await query(
    `SELECT id, school_id, grade, stream, full_name
     FROM learners
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function getProgress(user) {
  const learner = await getLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile not found.");

  const result = await query(
    `SELECT track_key,
            level_number,
            activity_key,
            activity_title,
            COUNT(*)::integer AS attempts,
            MAX(passed) AS passed,
            MAX(net_wpm)::numeric(8, 2) AS best_net_wpm,
            MAX(raw_wpm)::numeric(8, 2) AS best_raw_wpm,
            MAX(accuracy)::numeric(5, 2) AS best_accuracy,
            MIN(mistakes)::integer AS fewest_mistakes,
            MAX(submitted_at) AS last_attempt_at
     FROM typing_practice_attempts
     WHERE learner_id = $1
     GROUP BY track_key, level_number, activity_key, activity_title
     ORDER BY track_key, level_number, activity_key`,
    [learner.id],
  );

  return {
    learner,
    activities: result.rows,
  };
}

async function submitAttempt(user, data = {}) {
  const learner = await getLearnerForUser(user.userId);
  if (!learner) throw new Error("Learner profile not found.");

  const trackKey = cleanKey(data.track_key, "beginner");
  const activityKey = cleanKey(data.activity_key, "activity");
  if (!trackKey || !activityKey) {
    throw new Error("Practice activity is invalid.");
  }

  const levelNumber = numberInRange(data.level_number, 1, 50, 1);

  // Marks are recomputed here from the passage and the keystrokes. The browser
  // used to be believed outright, so a learner could post a perfect score for an
  // activity they never typed, and that score reached the teacher reports.
  const targetText = String(data.target_text || "");
  const score = scoreTypingAttempt(
    targetText,
    data.typed_text,
    data.duration_seconds,
    numberInRange(data.duration_seconds, 1, 3600, 60),
  );
  const durationSeconds = Math.round(numberInRange(data.duration_seconds, 1, 3600, 1));
  const rawWpm = numberInRange(score.raw_wpm, 0, 300, 0);
  const netWpm = numberInRange(score.final_score, 0, 300, 0);
  const accuracy = numberInRange(score.accuracy, 0, 100, 0);
  const mistakes = Math.round(numberInRange(score.mistakes, 0, 10000, 0));

  // An activity passes on the marks just calculated, never on a client claim.
  const goalWpm = numberInRange(data.goal_wpm, 0, 300, 0);
  const accuracyGoal = numberInRange(data.accuracy_goal, 0, 100, 100);
  const finished = score.expected_characters > 0 && score.typed_characters >= score.expected_characters;
  const passed = finished && accuracy >= accuracyGoal && netWpm >= goalWpm;

  const result = await query(
    `INSERT INTO typing_practice_attempts (
       learner_id, track_key, level_number, activity_key, activity_title,
       raw_wpm, net_wpm, accuracy, mistakes, duration_seconds, passed
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      learner.id,
      trackKey,
      levelNumber,
      activityKey,
      String(data.activity_title || "Typing practice").slice(0, 255),
      rawWpm,
      netWpm,
      accuracy,
      mistakes,
      durationSeconds,
      passed,
    ],
  );

  return result.rows[0];
}

function reportScope(user, filters = {}) {
  if (!["system_admin", "school_admin", "teacher"].includes(user.role)) {
    throw new Error("Insufficient permissions.");
  }

  const values = [];
  const where = [];
  let learnerScope = "";

  if (user.role === "system_admin") {
    if (filters.school_id) {
      values.push(filters.school_id);
      where.push(`l.school_id = $${values.length}`);
    }
  } else {
    if (!user.schoolId) throw new Error("School profile not found.");
    values.push(user.schoolId);
    where.push(`l.school_id = $${values.length}`);
    if (user.role === "teacher") {
      values.push(user.userId);
      learnerScope = `AND EXISTS (
        SELECT 1
        FROM course_allocations ca
        JOIN course_teacher_assignments cta ON cta.course_id = ca.course_id
        WHERE ca.learner_id = l.id
          AND cta.teacher_user_id = $${values.length}
          AND cta.is_active = true
      )`;
    }
  }

  if (filters.grade) {
    values.push(filters.grade);
    where.push(`l.grade = $${values.length}`);
  }
  if (filters.stream) {
    values.push(filters.stream);
    where.push(`l.stream = $${values.length}`);
  }
  if (filters.q) {
    values.push(`%${String(filters.q).trim()}%`);
    where.push(`l.full_name ILIKE $${values.length}`);
  }

  if (filters.learner_id) {
    values.push(filters.learner_id);
    where.push(`l.id = $${values.length}`);
  }
  return { values, whereSql: `WHERE ${where.length ? where.join(" AND ") : "1=1"} ${learnerScope}` };
}

async function getReport(user, filters = {}) {
  const { values, whereSql } = reportScope(user, filters);
  const result = await query(
    `WITH scoped_learners AS (
       SELECT l.id, l.full_name, l.grade, l.stream, l.school_id
       FROM learners l
       ${whereSql}
     ),
     learner_attempts AS (
       SELECT tpa.*
       FROM typing_practice_attempts tpa
       JOIN scoped_learners scope ON scope.id = tpa.learner_id
     ),
     activity_summary AS (
       SELECT learner_id,
              track_key,
              level_number,
              activity_key,
              MAX(passed) AS passed,
              COUNT(*)::integer AS attempts,
              MAX(net_wpm)::numeric(8, 2) AS best_net_wpm,
              MAX(accuracy)::numeric(5, 2) AS best_accuracy,
              MIN(mistakes)::integer AS fewest_mistakes,
              SUM(duration_seconds) AS practice_seconds,
              SUM(net_wpm) AS total_net_wpm,
              SUM(accuracy) AS total_accuracy,
              MAX(submitted_at) AS last_attempt_at
       FROM learner_attempts
       GROUP BY learner_id, track_key, level_number, activity_key
     ),
     learner_summary AS (
       SELECT learner_id,
              COUNT(*)::integer AS attempted_activities,
              COUNT(*) FILTER (WHERE passed)::integer AS completed_activities,
              COALESCE(SUM(attempts), 0)::integer AS total_attempts,
              MAX(best_net_wpm)::numeric(8, 2) AS best_net_wpm,
              MAX(best_accuracy)::numeric(5, 2) AS best_accuracy,
              MAX(last_attempt_at) AS last_practiced_at,
              SUM(practice_seconds) AS practice_seconds,
              SUM(total_net_wpm) / NULLIF(SUM(attempts), 0) AS average_net_wpm,
              SUM(total_accuracy) / NULLIF(SUM(attempts), 0) AS average_accuracy
       FROM activity_summary
       GROUP BY learner_id
     ),
     latest_activity AS (
       SELECT learner_id, track_key, level_number, activity_key
       FROM (
         SELECT learner_id, track_key, level_number, activity_key,
                ROW_NUMBER() OVER (
                  PARTITION BY learner_id ORDER BY last_attempt_at DESC
                ) AS recency
         FROM activity_summary
       ) ranked
       WHERE recency = 1
     )
     SELECT l.id AS learner_id,
            l.full_name,
            l.grade,
            l.stream,
            s.name AS school_name,
            COALESCE(la.track_key, 'beginner') AS current_track,
            COALESCE(la.level_number, 1) AS current_level,
            COALESCE(ls.attempted_activities, 0) AS attempted_activities,
            COALESCE(ls.completed_activities, 0) AS completed_activities,
            COALESCE(ls.total_attempts, 0) AS total_attempts,
            COALESCE(ls.best_net_wpm, 0)::numeric(8, 2) AS best_net_wpm,
            COALESCE(ls.best_accuracy, 0)::numeric(5, 2) AS best_accuracy,
            ls.last_practiced_at,
            COALESCE(ls.practice_seconds, 0) AS practice_seconds,
            ROUND(ls.average_net_wpm, 2) AS average_net_wpm,
            ROUND(ls.average_accuracy, 2) AS average_accuracy,
            CASE
              WHEN ls.learner_id IS NULL THEN 'not_started'
              WHEN COALESCE(ls.completed_activities, 0) < 3 AND COALESCE(ls.total_attempts, 0) >= 8 THEN 'needs_support'
              WHEN COALESCE(ls.best_accuracy, 0) < 80 AND COALESCE(ls.total_attempts, 0) >= 5 THEN 'accuracy_support'
              WHEN COALESCE(ls.completed_activities, 0) >= 10 THEN 'progressing'
              ELSE 'started'
            END AS status
     FROM scoped_learners l
     JOIN schools s ON s.id = l.school_id
     LEFT JOIN learner_summary ls ON ls.learner_id = l.id
     LEFT JOIN latest_activity la ON la.learner_id = l.id
     ORDER BY l.full_name`,
    values,
  );

  return result.rows;
}

async function getAttempts(user, learnerId, filters = {}) {
  const id = Number(learnerId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid learner.");
  const { values, whereSql } = reportScope(user, { learner_id: id });
  const learnerResult = await query(
    `SELECT l.id, l.full_name, l.grade, l.stream FROM learners l ${whereSql} LIMIT 1`,
    values,
  );
  const learner = learnerResult.rows[0];
  if (!learner) throw new Error("Learner not found or not assigned to you.");
  const limit = Math.floor(numberInRange(filters.limit, 1, 100, 20));
  const offset = Math.floor(numberInRange(filters.offset, 0, 1000000, 0));
  const [attempts, count] = await Promise.all([
    query(
      `SELECT id, track_key, level_number, activity_key, activity_title, raw_wpm, net_wpm,
              accuracy, mistakes, duration_seconds, passed, submitted_at
       FROM typing_practice_attempts WHERE learner_id = $1
       ORDER BY submitted_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    ),
    query("SELECT COUNT(*) AS total FROM typing_practice_attempts WHERE learner_id = $1", [id]),
  ]);
  return { learner, attempts: attempts.rows, total: Number(count.rows[0].total), limit, offset };
}

module.exports = {
  getProgress,
  submitAttempt,
  getReport,
  getAttempts,
};
