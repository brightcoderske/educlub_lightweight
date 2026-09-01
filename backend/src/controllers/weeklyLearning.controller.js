const { query } = require("../config");

async function getWeeklyCourses(req, res) {
  try {
    const category = req.query.category;
    const params = [];
    let categorySql = "AND c.course_category = 'weekly_quiz'";

    if (category === "weekly_quiz") {
      params.push(category);
      categorySql = `AND c.course_category = $${params.length}`;
    } else if (category === "weekly_typing") {
      return res.json([]);
    }

    let learnerJoin = "";
    let scopeSql = "";
    if (req.user.role === "learner") {
      params.push(req.user.userId);
      learnerJoin = `
        JOIN learners l ON l.user_id = $${params.length}
        JOIN course_allocations a
          ON a.course_id = c.id
         AND a.learner_id = l.id
         AND a.status IN ('active', 'in_progress', 'completed')
      `;
    } else if (req.user.role !== "system_admin") {
      // School staff see their own school's weekly courses, not the catalogue
      // of every school on the platform.
      params.push(Number(req.user.schoolId) || 0);
      scopeSql = ` AND c.school_id = $${params.length}::integer`;
    }

    const result = await query(
      `SELECT DISTINCT c.*
       FROM courses c
       ${learnerJoin}
       WHERE c.is_active = true
         ${categorySql}
         ${scopeSql}
       ORDER BY c.course_category, c.name`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get weekly courses error:", error);
    res.status(500).json({ error: "Failed to get typing/quizzes courses" });
  }
}

async function syncWeeklyResults(req, res) {
  try {
    const { term, academic_year, week_number } = req.body;

    if (!term || !academic_year) {
      return res.status(400).json({ error: "Term and academic year are required" });
    }

    const params = [term, Number(academic_year)];
    let weekSql = "";
    if (week_number) {
      params.push(Number(week_number));
      weekSql = ` AND qt.week_number = $${params.length}`;
    }

    // A school admin syncing their own week used to rewrite weekly_marks for
    // every learner in every school. Staff sync only their own learners; the
    // system administrator keeps the cross-school rebuild.
    let schoolSql = "";
    if (req.user.role !== "system_admin") {
      if (!req.user.schoolId) {
        return res
          .status(403)
          .json({ error: "Your account is not linked to a school." });
      }
      params.push(Number(req.user.schoolId));
      schoolSql = ` AND l.school_id = $${params.length}::integer`;
    }

    const result = await query(
      `WITH best_scores AS (
         SELECT qta.learner_id,
                qt.week_number,
                qt.term,
                qt.academic_year,
                MAX(qta.score)::integer AS quiz_score
         FROM quiz_test_attempts qta
         JOIN quiz_tests qt ON qt.id = qta.quiz_test_id
         JOIN learners l ON l.id = qta.learner_id
         WHERE qt.quiz_type = 'weekly'
           AND qt.term = $1::varchar
           AND qt.academic_year = $2::integer
           ${weekSql}
           ${schoolSql}
         GROUP BY qta.learner_id, qt.week_number, qt.term, qt.academic_year
       )
       INSERT INTO weekly_marks (learner_id, week_number, term, academic_year, quiz_score)
       SELECT learner_id, week_number, term, academic_year, quiz_score
       FROM best_scores
       ON CONFLICT (learner_id, week_number, term, academic_year)
       DO UPDATE SET quiz_score = EXCLUDED.quiz_score, updated_at = NOW()
       RETURNING learner_id`,
      params
    );

    res.json({
      message: `Synced ${result.rowCount || 0} weekly quiz result(s) to report cards.`,
      synced: result.rowCount || 0,
      week_number: week_number || null,
    });
  } catch (error) {
    console.error("Sync weekly results error:", error);
    res.status(500).json({ error: "Failed to sync typing/quizzes results" });
  }
}

module.exports = {
  getWeeklyCourses,
  syncWeeklyResults,
};
