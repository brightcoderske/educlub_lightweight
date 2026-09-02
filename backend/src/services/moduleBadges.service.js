const TIERS = {
  completion: { tier: "completion", label: "Completion", color: "#111827" },
  bronze: { tier: "bronze", label: "Bronze", color: "#b87333" },
  silver: { tier: "silver", label: "Silver", color: "#a7adb7" },
  gold: { tier: "gold", label: "Gold", color: "#d4af37" },
};
const { getTypingBadge } = require("./typingBadges");

function clampScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function getBadgeTier(value) {
  const score = clampScore(value);
  if (score > 90) return { ...TIERS.gold, score };
  if (score > 80) return { ...TIERS.silver, score };
  if (score >= 71) return { ...TIERS.bronze, score };
  return { ...TIERS.completion, score };
}

async function recalculateModuleBadge(learnerId, moduleId) {
  const { query } = require("../config");
  const progress = await query(
    `SELECT cm.course_id,
            COUNT(la.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
            )::integer AS required_total,
            COUNT(ap.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
                AND ap.status IN ('completed', 'graded')
            )::integer AS required_done,
            COALESCE(
              AVG(ap.score) FILTER (
                WHERE COALESCE(la.availability_mode, 'required') = 'required'
                  AND ap.score IS NOT NULL
              ),
              100
            )::numeric AS score,
            COALESCE(
              MAX(la.content->'module_badge'->>'name'),
              cm.title
            ) AS badge_name
     FROM course_modules cm
     LEFT JOIN learning_activities la ON la.module_id = cm.id
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      AND ap.learner_id = $1::integer
     WHERE cm.id = $2::integer
     GROUP BY cm.id, cm.course_id, cm.title`,
    [learnerId, moduleId],
  );
  const row = progress.rows[0];
  if (!row || Number(row.required_total) < 1 || Number(row.required_done) < Number(row.required_total)) {
    return null;
  }

  const badge = getBadgeTier(row.score);
  const result = await query(
    `INSERT INTO learner_module_badges (
       learner_id, course_id, module_id, tier, score_percent, badge_name,
       awarded_at, updated_at
     )
     VALUES ($1::integer, $2::integer, $3::integer, $4::varchar, $5::numeric,
             $6::varchar, NOW(), NOW())
     ON CONFLICT (learner_id, module_id)
     DO UPDATE SET
       tier = EXCLUDED.tier,
       score_percent = EXCLUDED.score_percent,
       badge_name = EXCLUDED.badge_name,
       updated_at = NOW()
     RETURNING *`,
    [learnerId, row.course_id, moduleId, badge.tier, badge.score, row.badge_name],
  );
  return { ...result.rows[0], color: badge.color, label: badge.label };
}

async function listLearnerBadges(learnerId) {
  const { query } = require("../config");
  const [result, typingResult] = await Promise.all([
    query(
    `SELECT b.*, c.name AS course_name, cm.title AS module_title
     FROM learner_module_badges b
     JOIN courses c ON c.id = b.course_id
     JOIN course_modules cm ON cm.id = b.module_id
     WHERE b.learner_id = $1::integer
    ORDER BY b.updated_at DESC`,
    [learnerId],
    ),
    query(
      `WITH lesson_totals AS (
         SELECT typing_test_id, COUNT(*)::integer AS lesson_count
         FROM typing_lessons
         GROUP BY typing_test_id
       ),
       completed_trials AS (
         SELECT ta.typing_test_id,
                ta.attempt_number,
                AVG(ta.final_score)::numeric AS net_wpm,
                AVG(ta.accuracy)::numeric AS accuracy,
                MAX(ta.submitted_at) AS awarded_at
         FROM typing_attempts ta
         JOIN lesson_totals lt ON lt.typing_test_id = ta.typing_test_id
         WHERE ta.learner_id = $1::integer
         GROUP BY ta.typing_test_id, ta.attempt_number, lt.lesson_count
         HAVING COUNT(DISTINCT ta.typing_lesson_id) = lt.lesson_count
       ),
       ranked AS (
         SELECT *, ROW_NUMBER() OVER (
           PARTITION BY typing_test_id
           ORDER BY net_wpm DESC, accuracy DESC, attempt_number ASC
         ) AS \`rank\`
         FROM completed_trials
       )
       SELECT ranked.*, tt.name AS test_name
       FROM ranked
       JOIN typing_tests tt ON tt.id = ranked.typing_test_id
       WHERE ranked.\`rank\` = 1
       ORDER BY ranked.awarded_at DESC`,
      [learnerId],
    ),
  ]);
  const moduleBadges = result.rows.map((row) => ({
    ...row,
    ...getBadgeTier(row.score_percent),
    badge_type: "module",
  }));
  const typingBadges = typingResult.rows.map((row) => {
    const badge = getTypingBadge(row.net_wpm, row.accuracy);
    return {
      id: `typing-${row.typing_test_id}`,
      badge_type: "typing",
      badge_name: row.test_name,
      score_percent: Number(row.accuracy || 0),
      net_wpm: Number(row.net_wpm || 0),
      awarded_at: row.awarded_at,
      ...badge,
    };
  });
  return [...typingBadges, ...moduleBadges].sort(
    (left, right) => new Date(right.awarded_at || 0) - new Date(left.awarded_at || 0),
  );
}

module.exports = { getBadgeTier, recalculateModuleBadge, listLearnerBadges };
