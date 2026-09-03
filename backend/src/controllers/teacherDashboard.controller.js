const { query } = require("../config");
const { getSchoolPopulation } = require("../services/schoolPopulation.service");

async function getDashboard(req, res) {
  try {
    const params = [req.user.userId, req.user.schoolId];
    const [courses, summary, submissions, schedule, population] = await Promise.all([
      query(
        `SELECT c.id, c.name, c.description, c.template_version,
                c.school_version, c.is_active,
                (c.template_id IS NOT NULL
                  AND COALESCE(c.template_version, 0) <
                      COALESCE(ct.version, 1)) AS update_available,
                (SELECT COUNT(DISTINCT ca.learner_id)
                 FROM course_allocations ca
                 WHERE ca.course_id = c.id AND ca.status IN ('active', 'completed')) AS learner_count
         FROM course_teacher_assignments cta
         JOIN courses c ON c.id = cta.course_id
         LEFT JOIN course_templates ct ON ct.id = c.template_id
         WHERE cta.teacher_user_id = $1
           AND cta.is_active = true
           AND c.school_id = $2
         ORDER BY c.name`,
        params,
      ),
      query(
        `SELECT
           COUNT(DISTINCT cta.course_id)::int AS course_count,
           COUNT(DISTINCT ca.learner_id)::int AS learner_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'submitted')::int
             AS pending_submissions
         FROM course_teacher_assignments cta
         JOIN courses c ON c.id = cta.course_id AND c.school_id = $2
         LEFT JOIN course_allocations ca
           ON ca.course_id = cta.course_id
          AND ca.status IN ('active', 'completed')
         LEFT JOIN course_modules cm ON cm.course_id = cta.course_id
         LEFT JOIN learning_activities la ON la.module_id = cm.id
         LEFT JOIN activity_submissions s ON s.activity_id = la.id
         WHERE cta.teacher_user_id = $1 AND cta.is_active = true`,
        params,
      ),
      query(
        `SELECT s.id, s.submitted_at, s.status, l.full_name AS learner_name,
                la.title AS activity_title, c.id AS course_id,
                c.name AS course_name
         FROM course_teacher_assignments cta
         JOIN courses c ON c.id = cta.course_id AND c.school_id = $2
         JOIN course_modules cm ON cm.course_id = c.id
         JOIN learning_activities la ON la.module_id = cm.id
         JOIN activity_submissions s ON s.activity_id = la.id
         JOIN learners l ON l.id = s.learner_id
         WHERE cta.teacher_user_id = $1 AND cta.is_active = true
         ORDER BY s.submitted_at DESC
         LIMIT 8`,
        params,
      ),
      query(
        `SELECT c.id AS course_id, c.name AS course_name, cm.id AS module_id,
                cm.title AS module_title, sms.week_number, sms.opens_at
         FROM course_teacher_assignments cta
         JOIN courses c ON c.id = cta.course_id AND c.school_id = $2
         JOIN course_modules cm ON cm.course_id = c.id
         JOIN school_module_schedules sms ON sms.module_id = cm.id
         JOIN terms t ON t.id = sms.term_id AND t.is_active = true
         WHERE cta.teacher_user_id = $1
           AND cta.is_active = true
           AND sms.opens_at <= CURRENT_TIMESTAMP
         ORDER BY sms.opens_at DESC
         LIMIT 8`,
        params,
      ),
      getSchoolPopulation(req.user.schoolId),
    ]);

    res.json({
      summary: summary.rows[0] || {},
      courses: courses.rows,
      recentSubmissions: submissions.rows,
      currentSchedule: schedule.rows,
      population,
    });
  } catch (error) {
    console.error("Teacher dashboard error:", error);
    res.status(500).json({ error: "Failed to load teacher dashboard" });
  }
}

module.exports = { getDashboard };
