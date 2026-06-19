const { query } = require("../config");

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
            BOOL_OR(passed) AS passed,
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
  const durationSeconds = numberInRange(data.duration_seconds, 1, 3600, 60);
  const rawWpm = numberInRange(data.raw_wpm, 0, 300, 0);
  const netWpm = numberInRange(data.net_wpm, 0, 300, 0);
  const accuracy = numberInRange(data.accuracy, 0, 100, 0);
  const mistakes = Math.round(numberInRange(data.mistakes, 0, 10000, 0));
  const passed = data.passed === true || data.passed === "true";

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

async function getReport(user, filters = {}) {
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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await query(
    `WITH learner_attempts AS (
       SELECT tpa.*
       FROM typing_practice_attempts tpa
     ),
     activity_summary AS (
       SELECT learner_id,
              track_key,
              level_number,
              activity_key,
              BOOL_OR(passed) AS passed,
              COUNT(*)::integer AS attempts,
              MAX(net_wpm)::numeric(8, 2) AS best_net_wpm,
              MAX(accuracy)::numeric(5, 2) AS best_accuracy,
              MIN(mistakes)::integer AS fewest_mistakes,
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
              MAX(last_attempt_at) AS last_practiced_at
       FROM activity_summary
       GROUP BY learner_id
     ),
     latest_activity AS (
       SELECT DISTINCT ON (learner_id)
              learner_id, track_key, level_number, activity_key
       FROM activity_summary
       ORDER BY learner_id, last_attempt_at DESC
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
            CASE
              WHEN ls.learner_id IS NULL THEN 'not_started'
              WHEN COALESCE(ls.completed_activities, 0) < 3 AND COALESCE(ls.total_attempts, 0) >= 8 THEN 'needs_support'
              WHEN COALESCE(ls.best_accuracy, 0) < 80 AND COALESCE(ls.total_attempts, 0) >= 5 THEN 'accuracy_support'
              WHEN COALESCE(ls.completed_activities, 0) >= 10 THEN 'progressing'
              ELSE 'started'
            END AS status
     FROM learners l
     JOIN schools s ON s.id = l.school_id
     LEFT JOIN learner_summary ls ON ls.learner_id = l.id
     LEFT JOIN latest_activity la ON la.learner_id = l.id
     ${whereSql}
     ${whereSql ? "AND" : "WHERE"} 1=1
     ${learnerScope}
     ORDER BY l.full_name`,
    values,
  );

  return result.rows;
}

module.exports = {
  getProgress,
  submitAttempt,
  getReport,
};
