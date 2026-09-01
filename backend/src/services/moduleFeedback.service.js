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
  // Named only so they can be discarded - the identifying columns must not
  // survive into the returned row.
  const { learner_id, learner_name, email, ...anonymous } = row;
  return anonymous;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDateFilter(value, label) {
  if (!value) return null;
  const clean = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(clean))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return clean;
}

function normalizeReportFilters(filters = {}) {
  const requestedPage = normalizePositiveInteger(filters.page);
  const requestedPageSize = normalizePositiveInteger(filters.pageSize);
  const rating =
    filters.rating === undefined || filters.rating === ""
      ? null
      : Number.parseInt(filters.rating, 10);

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating filter must be between 1 and 5.");
  }

  return {
    page: requestedPage || 1,
    pageSize: Math.min(requestedPageSize || 10, 50),
    rating,
    moduleId: normalizePositiveInteger(filters.moduleId),
    schoolId: normalizePositiveInteger(filters.schoolId),
    search: String(filters.search || "").trim().slice(0, 120),
    from: normalizeDateFilter(filters.from, "From date"),
    to: normalizeDateFilter(filters.to, "To date"),
  };
}

function resolveReportSchoolScope(user = {}, requestedSchoolId = null) {
  if (!["system_admin", "school_admin", "teacher"].includes(user.role)) {
    throw new Error("Staff access is required.");
  }
  if (user.role !== "system_admin") {
    const schoolId = normalizePositiveInteger(user.schoolId);
    if (!schoolId) throw new Error("A school assignment is required.");
    return schoolId;
  }
  return normalizePositiveInteger(requestedSchoolId);
}

function feedbackAggregateColumns(alias = "mf") {
  return `COUNT(${alias}.id)::integer AS response_count,
          ROUND(AVG(${alias}.rating)::numeric, 2) AS average_rating,
          COUNT(${alias}.id) FILTER (WHERE ${alias}.rating = 1)::integer AS rating_1,
          COUNT(${alias}.id) FILTER (WHERE ${alias}.rating = 2)::integer AS rating_2,
          COUNT(${alias}.id) FILTER (WHERE ${alias}.rating = 3)::integer AS rating_3,
          COUNT(${alias}.id) FILTER (WHERE ${alias}.rating = 4)::integer AS rating_4,
          COUNT(${alias}.id) FILTER (WHERE ${alias}.rating = 5)::integer AS rating_5`;
}

function paginationResult(filters, total) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    total: Number(total || 0),
    totalPages: Math.max(1, Math.ceil(Number(total || 0) / filters.pageSize)),
  };
}

async function getTemplateFeedbackReport(templateId, user = {}, rawFilters = {}) {
  if (user.role !== "system_admin") {
    throw new Error("System administrator access is required.");
  }
  const { query } = require("../config");
  const filters = normalizeReportFilters(rawFilters);
  const templateResult = await query(
    `SELECT id, name, code, version, target_level
     FROM course_templates
     WHERE id = $1::integer`,
    [templateId],
  );
  const template = templateResult.rows[0];
  if (!template) throw new Error("Course template not found.");

  const summaryResult = await query(
    `SELECT ${feedbackAggregateColumns("mf")},
            COUNT(DISTINCT c.school_id)::integer AS school_count,
            COUNT(DISTINCT c.id)::integer AS course_version_count,
            COUNT(DISTINCT mf.module_id) FILTER (
              WHERE module_average.average_rating < 3
            )::integer AS low_rated_module_count
     FROM courses c
     LEFT JOIN module_feedback mf ON mf.course_id = c.id
     LEFT JOIN (
       SELECT module_id, AVG(rating)::numeric AS average_rating
       FROM module_feedback
       GROUP BY module_id
     ) module_average ON module_average.module_id = mf.module_id
     WHERE c.template_id = $1::integer`,
    [templateId],
  );

  const listParams = [templateId];
  const conditions = [];
  if (filters.schoolId) {
    listParams.push(filters.schoolId);
    conditions.push(`c.school_id = $${listParams.length}::integer`);
  }
  if (filters.search) {
    listParams.push(`%${filters.search}%`);
    conditions.push(
      `(s.name ILIKE $${listParams.length}::text OR c.name ILIKE $${listParams.length}::text)`,
    );
  }
  const filterSql = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT COUNT(*)::integer AS total
     FROM courses c
     JOIN schools s ON s.id = c.school_id
     WHERE c.template_id = $1::integer${filterSql}`,
    listParams,
  );

  const offset = (filters.page - 1) * filters.pageSize;
  const pageParams = [...listParams, filters.pageSize, offset];
  const pageSizePosition = pageParams.length - 1;
  const offsetPosition = pageParams.length;
  const schoolVersions = await query(
    `WITH feedback_by_course AS (
       SELECT course_id,
              COUNT(*)::integer AS response_count,
              ROUND(AVG(rating)::numeric, 2) AS average_rating,
              MAX(updated_at) AS latest_review_at
       FROM module_feedback
       GROUP BY course_id
     ),
     module_ratings AS (
       SELECT course_id, module_id, AVG(rating)::numeric AS average_rating
       FROM module_feedback
       GROUP BY course_id, module_id
     ),
     module_by_course AS (
       SELECT course_id,
              ROUND(MIN(average_rating)::numeric, 2) AS lowest_module_rating,
              COUNT(*) FILTER (WHERE average_rating < 3)::integer AS low_rated_module_count
       FROM module_ratings
       GROUP BY course_id
     )
     SELECT c.id AS course_id,
            c.name AS course_name,
            c.school_id,
            s.name AS school_name,
            COALESCE(c.school_version, 1) AS school_version,
            COALESCE(c.template_version, 1) AS template_version,
            COALESCE(fbc.response_count, 0)::integer AS response_count,
            fbc.average_rating,
            mbc.lowest_module_rating,
            COALESCE(mbc.low_rated_module_count, 0)::integer AS low_rated_module_count,
            fbc.latest_review_at
     FROM courses c
     JOIN schools s ON s.id = c.school_id
     LEFT JOIN feedback_by_course fbc ON fbc.course_id = c.id
     LEFT JOIN module_by_course mbc ON mbc.course_id = c.id
     WHERE c.template_id = $1::integer${filterSql}
     ORDER BY fbc.latest_review_at DESC NULLS LAST, s.name
     LIMIT $${pageSizePosition}::integer
     OFFSET $${offsetPosition}::integer`,
    pageParams,
  );

  return {
    mode: "template",
    template,
    summary: summaryResult.rows[0],
    schoolVersions: schoolVersions.rows,
    pagination: paginationResult(filters, countResult.rows[0]?.total),
  };
}

function buildFeedbackFilterSql(filters, params, alias = "mf") {
  const conditions = [];
  if (filters.moduleId) {
    params.push(filters.moduleId);
    conditions.push(`${alias}.module_id = $${params.length}::integer`);
  }
  if (filters.rating) {
    params.push(filters.rating);
    conditions.push(`${alias}.rating = $${params.length}::integer`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`${alias}.updated_at >= $${params.length}::date`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`${alias}.updated_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  return conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
}

async function getCourseFeedbackReport(courseId, user = {}, rawFilters = {}) {
  const filters = normalizeReportFilters(rawFilters);
  const schoolId = resolveReportSchoolScope(user, filters.schoolId);
  const { query } = require("../config");
  const courseParams = [courseId];
  let schoolScopeSql = "";
  if (user.role !== "system_admin") {
    courseParams.push(schoolId);
    schoolScopeSql = ` AND c.school_id = $2::integer`;
  } else if (schoolId) {
    courseParams.push(schoolId);
    schoolScopeSql = ` AND c.school_id = $2::integer`;
  }

  const courseResult = await query(
    `SELECT c.id, c.name, c.code, c.template_id, c.school_id,
            COALESCE(c.school_version, 1) AS school_version,
            COALESCE(c.template_version, 1) AS template_version,
            s.name AS school_name,
            t.name AS template_name
     FROM courses c
     JOIN schools s ON s.id = c.school_id
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE c.id = $1::integer${schoolScopeSql}`,
    courseParams,
  );
  const course = courseResult.rows[0];
  if (!course) throw new Error("Course version not found or access denied.");

  const aggregateParams = [courseId];
  const feedbackFilterSql = buildFeedbackFilterSql(filters, aggregateParams);
  const summaryResult = await query(
    `SELECT ${feedbackAggregateColumns("mf")}
     FROM module_feedback mf
     WHERE mf.course_id = $1::integer${feedbackFilterSql}`,
    aggregateParams,
  );

  const moduleParams = [courseId];
  const moduleFilterSql = buildFeedbackFilterSql(
    { ...filters, moduleId: null },
    moduleParams,
  );
  const modulesResult = await query(
    `SELECT cm.id AS module_id,
            cm.title AS module_title,
            cm.position,
            ${feedbackAggregateColumns("mf")}
     FROM course_modules cm
     LEFT JOIN module_feedback mf
       ON mf.module_id = cm.id
      ${moduleFilterSql}
     WHERE cm.course_id = $1::integer
     GROUP BY cm.id, cm.title, cm.position
     ORDER BY cm.position, cm.title`,
    moduleParams,
  );

  const commentParams = [courseId];
  const commentFilterSql = buildFeedbackFilterSql(filters, commentParams);
  const countResult = await query(
    `SELECT COUNT(*)::integer AS total
     FROM module_feedback mf
     WHERE mf.course_id = $1::integer
       AND NULLIF(mf.comment, '') IS NOT NULL${commentFilterSql}`,
    commentParams,
  );
  const offset = (filters.page - 1) * filters.pageSize;
  const pageParams = [...commentParams, filters.pageSize, offset];
  const pageSizePosition = pageParams.length - 1;
  const offsetPosition = pageParams.length;
  const commentsResult = await query(
    `SELECT mf.id, mf.module_id, cm.title AS module_title, mf.rating,
            mf.comment, mf.module_version, mf.updated_at
     FROM module_feedback mf
     JOIN course_modules cm ON cm.id = mf.module_id
     WHERE mf.course_id = $1::integer
       AND NULLIF(mf.comment, '') IS NOT NULL${commentFilterSql}
     ORDER BY mf.updated_at DESC
     LIMIT $${pageSizePosition}::integer
     OFFSET $${offsetPosition}::integer`,
    pageParams,
  );

  return {
    mode: "course",
    course,
    summary: summaryResult.rows[0],
    modules: modulesResult.rows,
    comments: commentsResult.rows.map(anonymizeFeedbackRow),
    pagination: paginationResult(filters, countResult.rows[0]?.total),
  };
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

async function getModuleFeedbackSummary(moduleId, user = {}) {
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
  normalizeReportFilters,
  resolveReportSchoolScope,
  getTemplateFeedbackReport,
  getCourseFeedbackReport,
  upsertModuleFeedback,
  getModuleFeedbackSummary,
  revealFeedbackIdentity,
};
