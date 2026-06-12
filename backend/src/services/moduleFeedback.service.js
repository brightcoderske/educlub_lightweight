function validateFeedback(data = {}) {
  const rating = Number(data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }
  return {
    rating,
    comment: String(data.comment || "").trim().slice(0, 2000),
  };
}

function anonymizeFeedbackRow(row = {}) {
  const { learner_id, learner_name, email, ...anonymous } = row;
  return anonymous;
}

async function upsertModuleFeedback(moduleId, learner, data = {}) {
  const { query } = require("../config");
  const feedback = validateFeedback(data);
  const moduleResult = await query(
    `SELECT cm.id, cm.course_id, c.school_id, COALESCE(c.school_version, 1) AS module_version,
            COUNT(la.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
            )::integer AS required_total,
            COUNT(ap.id) FILTER (
              WHERE COALESCE(la.availability_mode, 'required') = 'required'
                AND la.is_published = true
                AND ap.status IN ('completed', 'graded')
            )::integer AS required_done
     FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     LEFT JOIN learning_activities la ON la.module_id = cm.id
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      AND ap.learner_id = $2::integer
     WHERE cm.id = $1::integer
     GROUP BY cm.id, cm.course_id, c.school_id, c.school_version`,
    [moduleId, learner.id],
  );
  const module = moduleResult.rows[0];
  if (!module || Number(module.required_total) < 1 ||
      Number(module.required_done) < Number(module.required_total)) {
    throw new Error("Complete the module before rating it.");
  }

  const result = await query(
    `INSERT INTO module_feedback (
       learner_id, school_id, course_id, module_id, module_version,
       rating, comment, created_at, updated_at
     )
     VALUES ($1::integer, $2::integer, $3::integer, $4::integer, $5::integer,
             $6::integer, NULLIF($7::text, ''), NOW(), NOW())
     ON CONFLICT (learner_id, module_id)
     DO UPDATE SET
       rating = EXCLUDED.rating,
       comment = EXCLUDED.comment,
       module_version = EXCLUDED.module_version,
       updated_at = NOW()
     RETURNING id, module_id, rating, comment, created_at, updated_at`,
    [
      learner.id,
      module.school_id,
      module.course_id,
      moduleId,
      module.module_version,
      feedback.rating,
      feedback.comment,
    ],
  );
  return result.rows[0];
}

async function getModuleFeedbackSummary(moduleId, user = {}, filters = {}) {
  const { query } = require("../config");
  const params = [moduleId];
  let scope = "";
  if (user.role !== "system_admin") {
    params.push(user.schoolId);
    scope = ` AND mf.school_id = $2::integer`;
  }
  const summary = await query(
    `SELECT COUNT(*)::integer AS response_count,
            ROUND(AVG(rating)::numeric, 2) AS average_rating,
            COUNT(*) FILTER (WHERE rating = 1)::integer AS rating_1,
            COUNT(*) FILTER (WHERE rating = 2)::integer AS rating_2,
            COUNT(*) FILTER (WHERE rating = 3)::integer AS rating_3,
            COUNT(*) FILTER (WHERE rating = 4)::integer AS rating_4,
            COUNT(*) FILTER (WHERE rating = 5)::integer AS rating_5
     FROM module_feedback mf
     WHERE mf.module_id = $1::integer${scope}`,
    params,
  );
  const comments = await query(
    `SELECT mf.id, mf.rating, mf.comment, mf.module_version, mf.updated_at
     FROM module_feedback mf
     WHERE mf.module_id = $1::integer${scope}
       AND NULLIF(mf.comment, '') IS NOT NULL
     ORDER BY mf.updated_at DESC
     LIMIT 100`,
    params,
  );
  return {
    ...summary.rows[0],
    comments: comments.rows.map(anonymizeFeedbackRow),
  };
}

async function revealFeedbackIdentity(feedbackId, user = {}, reason = "") {
  if (user.role !== "system_admin") throw new Error("System administrator access is required.");
  const cleanReason = String(reason).trim();
  if (!cleanReason) throw new Error("A moderation reason is required.");
  const { query } = require("../config");
  const result = await query(
    `SELECT mf.id, mf.learner_id, l.full_name AS learner_name, l.email
     FROM module_feedback mf
     JOIN learners l ON l.id = mf.learner_id
     WHERE mf.id = $1::integer`,
    [feedbackId],
  );
  if (!result.rows[0]) throw new Error("Feedback not found.");
  await query(
    `INSERT INTO feedback_identity_audits (
       feedback_id, accessed_by_user_id, reason
     )
     VALUES ($1::integer, $2::integer, $3::text)`,
    [feedbackId, user.userId, cleanReason],
  );
  return result.rows[0];
}

module.exports = {
  validateFeedback,
  anonymizeFeedbackRow,
  upsertModuleFeedback,
  getModuleFeedbackSummary,
  revealFeedbackIdentity,
};
