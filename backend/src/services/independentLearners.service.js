const { query } = require("../config");
const courseTemplatesService = require("./courseTemplates.service");

const INDEPENDENT_SCHOOL_CODE = "EDUCLUB-INDEPENDENT";
const INDEPENDENT_SCHOOL_NAME = "eduClub Independent Learners";
const PREVIEW_EXTRA_ACTIVITY_LIMIT = 3;

async function ensureIndependentSchool() {
  const result = await query(
    `INSERT INTO schools (
       name, code, email, allow_self_registration, is_independent_school, is_active
     )
     VALUES ($1, $2, 'support@educlub.co.ke', true, true, true)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           allow_self_registration = true,
           is_independent_school = true,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [INDEPENDENT_SCHOOL_NAME, INDEPENDENT_SCHOOL_CODE],
  );
  return result.rows[0];
}

async function getIndependentSchool() {
  const result = await query(
    `SELECT *
     FROM schools
     WHERE code = $1
        OR is_independent_school = true
     ORDER BY (code = $1) DESC, id
     LIMIT 1`,
    [INDEPENDENT_SCHOOL_CODE],
  );
  return result.rows[0] || ensureIndependentSchool();
}

async function isIndependentSchool(schoolId) {
  if (!schoolId) return false;
  const result = await query(
    `SELECT id
     FROM schools
     WHERE id = $1::integer
       AND (is_independent_school = true OR code = $2)
     LIMIT 1`,
    [schoolId, INDEPENDENT_SCHOOL_CODE],
  );
  return Boolean(result.rows[0]);
}

async function ensureIndependentSchoolCourses() {
  const school = await ensureIndependentSchool();
  const templates = await query(
    `SELECT id
     FROM course_templates
     WHERE is_active = true
       AND COALESCE(course_category, 'general') = 'general'
     ORDER BY name`,
  );

  const adopted = [];
  for (const template of templates.rows) {
    const course = await courseTemplatesService.adoptTemplate(template.id, {
      role: "school_admin",
      schoolId: school.id,
    });
    adopted.push(course);
  }
  return { school, courses: adopted };
}

async function allocateIndependentPreviewCourses(learner, term = {}) {
  if (!learner?.id) return { count: 0, courses: [] };
  const { school, courses } = await ensureIndependentSchoolCourses();
  if (Number(learner.school_id) !== Number(school.id)) return { count: 0, courses: [] };

  const allocated = [];
  for (const course of courses) {
    const result = await query(
      `INSERT INTO course_allocations (
         learner_id, course_id, term, academic_year, status,
         access_level, preview_activity_limit
       )
       VALUES ($1, $2, $3, $4, 'active', 'preview', $5)
       ON CONFLICT (learner_id, course_id, term, academic_year)
       DO UPDATE SET
         status = CASE
           WHEN course_allocations.access_level = 'paid' THEN course_allocations.status
           ELSE 'active'
         END,
         access_level = CASE
           WHEN course_allocations.access_level = 'paid' THEN 'paid'
           ELSE 'preview'
         END,
         preview_activity_limit = GREATEST(
           COALESCE(course_allocations.preview_activity_limit, 0),
           EXCLUDED.preview_activity_limit
         )
       RETURNING *`,
      [
        learner.id,
        course.id,
        term.name || learner.term || null,
        term.academic_year || learner.academic_year || null,
        PREVIEW_EXTRA_ACTIVITY_LIMIT,
      ],
    );
    allocated.push(result.rows[0]);
  }
  return { count: allocated.length, courses };
}

module.exports = {
  INDEPENDENT_SCHOOL_CODE,
  INDEPENDENT_SCHOOL_NAME,
  PREVIEW_EXTRA_ACTIVITY_LIMIT,
  allocateIndependentPreviewCourses,
  ensureIndependentSchool,
  ensureIndependentSchoolCourses,
  getIndependentSchool,
  isIndependentSchool,
};
