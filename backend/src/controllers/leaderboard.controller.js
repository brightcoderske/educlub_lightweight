const { query } = require("../config");
const leaderboardService = require("../services/leaderboard.service");
const courseProgressService = require("../services/courseProgress.service");
const academicService = require("../services/academic.service");
const { resolveAssessmentScope } = require("../services/assessmentTermScope");

async function ensureLearnerAccess(req, learnerId) {
  if (req.user.role === "system_admin") return true;

  const result = await query(
    "SELECT school_id, user_id FROM learners WHERE id = $1",
    [learnerId]
  );
  const learner = result.rows[0];
  if (!learner) return false;

  if (req.user.role === "school_admin" || req.user.role === "teacher") {
    return Number(learner.school_id) === Number(req.user.schoolId);
  }

  return Number(learner.user_id) === Number(req.user.userId);
}

async function getWeeklyLeaderboard(req, res) {
  try {
    let { weekNumber, term, academicYear, category } = req.params;
    const { term_type } = req.query;
    const schoolId = req.user.schoolId;

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear || new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const leaderboard = await leaderboardService.generateWeeklyLeaderboard(
      parseInt(weekNumber),
      term,
      parseInt(academicYear),
      category,
      schoolId
    );

    res.json(leaderboard);
  } catch (error) {
    console.error("Get weekly leaderboard error:", error);
    res.status(500).json({ error: "Failed to get weekly leaderboard" });
  }
}

async function getAllWeeklyLeaderboards(req, res) {
  try {
    let { weekNumber, term, academicYear } = req.params;
    const { term_type } = req.query;
    const schoolId = req.user.schoolId;

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear || new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const leaderboards = await leaderboardService.getAllWeeklyLeaderboards(
      parseInt(weekNumber),
      term,
      parseInt(academicYear),
      schoolId
    );

    res.json(leaderboards);
  } catch (error) {
    console.error("Get all weekly leaderboards error:", error);
    res.status(500).json({ error: "Failed to get all weekly leaderboards" });
  }
}

async function getLearnerPosition(req, res) {
  try {
    const { learnerId, weekNumber, term, academicYear, category } = req.params;

    if (!(await ensureLearnerAccess(req, learnerId))) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    const position = await leaderboardService.getLearnerPosition(
      parseInt(learnerId),
      parseInt(weekNumber),
      term,
      parseInt(academicYear),
      category
    );

    res.json({ position });
  } catch (error) {
    console.error("Get learner position error:", error);
    res.status(500).json({ error: "Failed to get learner position" });
  }
}

async function getLearnerTrend(req, res) {
  try {
    let { learnerId, term, academicYear, category } = req.params;
    const { term_type } = req.query;

    if (!(await ensureLearnerAccess(req, learnerId))) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear || new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const trend = await leaderboardService.getLearnerTrend(
      parseInt(learnerId),
      term,
      parseInt(academicYear),
      category
    );

    res.json(trend);
  } catch (error) {
    console.error("Get learner trend error:", error);
    res.status(500).json({ error: "Failed to get learner trend" });
  }
}

async function getTopPerformers(req, res) {
  try {
    let { term, academicYear, category } = req.params;
    const { term_type } = req.query;
    const schoolId = req.user.schoolId;
    const limit = parseInt(req.query.limit) || 10;

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear || new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const topPerformers = await leaderboardService.getTopPerformers(
      term,
      parseInt(academicYear),
      category,
      schoolId,
      limit
    );

    res.json(topPerformers);
  } catch (error) {
    console.error("Get top performers error:", error);
    res.status(500).json({ error: "Failed to get top performers" });
  }
}

async function getLearnerWeeklySummary(req, res) {
  try {
    let { learnerId, term, academicYear } = req.params;
    const { term_type } = req.query;

    if (!(await ensureLearnerAccess(req, learnerId))) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    // If term and academicYear are not provided, use the active term
    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm(
        term_type || "regular"
      );
      if (activeTerm) {
        term = term || activeTerm.name;
        academicYear =
          academicYear || new Date(activeTerm.start_date).getFullYear();
      } else {
        return res.status(400).json({
          error: "No active term found. Please specify term and academic year.",
        });
      }
    }

    const summary = await leaderboardService.getLearnerWeeklySummary(
      parseInt(learnerId),
      term,
      parseInt(academicYear)
    );

    res.json(summary);
  } catch (error) {
    console.error("Get learner weekly summary error:", error);
    res.status(500).json({ error: "Failed to get learner weekly summary" });
  }
}

async function getLearnerCourseProgress(req, res) {
  try {
    const { learnerId } = req.params;
    let { term, academicYear } = req.query;

    const allowed = await ensureLearnerAccess(req, Number(learnerId));
    if (!allowed) {
      return res.status(403).json({ error: "Learner is outside your access" });
    }

    if (!term || !academicYear) {
      const activeTerm = await academicService.getActiveTerm("regular");
      term = term || activeTerm?.name || "Term 1";
      academicYear =
        academicYear ||
        activeTerm?.academic_year ||
        (activeTerm?.start_date
          ? new Date(activeTerm.start_date).getFullYear()
          : new Date().getFullYear());
    }

    const progress = await courseProgressService.getLearnerCourseProgress(
      Number(learnerId),
      term,
      Number(academicYear)
    );
    res.json(progress);
  } catch (error) {
    console.error("Get learner course progress error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to get course progress" });
  }
}

async function getSchoolCourseProgress(req, res) {
  try {
    if (req.user.role !== "school_admin" && req.user.role !== "teacher") {
      return res.status(403).json({ error: "School admin access required" });
    }

    const {
      courseId,
      term,
      academicYear,
      grade,
      stream,
      moduleNumber,
      performance,
    } = req.query;
    if (!courseId) {
      return res.status(400).json({ error: "Course is required" });
    }

    const progress = await courseProgressService.getSchoolCourseProgress({
      schoolId: req.user.schoolId,
      courseId: Number(courseId),
      term,
      academicYear: Number(academicYear || new Date().getFullYear()),
      grade,
      stream,
      moduleNumber,
      performance,
    });

    res.json(progress);
  } catch (error) {
    console.error("Get school course progress error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to get learner progress" });
  }
}

async function getSchoolCompletionSummary(req, res) {
  try {
    if (req.user.role !== "school_admin" && req.user.role !== "teacher") {
      return res.status(403).json({ error: "School admin access required" });
    }

    const { term, academicYear } = req.query;
    const summary = await courseProgressService.getSchoolCompletionSummary({
      schoolId: req.user.schoolId,
      term,
      academicYear: academicYear ? Number(academicYear) : undefined,
    });

    res.json(summary);
  } catch (error) {
    console.error("Get school completion summary error:", error);
    res.status(500).json({
      error: error.message || "Failed to get school completion summary",
    });
  }
}

// Whole-cohort weekly marks in one round trip. Deliberately a single set-based
// query rather than a per-learner fetch: the matrix renders every learner
// against every week, so anything per-learner would multiply network latency by
// the size of the school.
async function getSchoolWeeklyMatrix(req, res) {
  try {
    if (!["school_admin", "teacher", "system_admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "School staff access required" });
    }

    const schoolId =
      req.user.role === "system_admin" ? req.query.schoolId : req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    const period = await resolveAssessmentScope(req.user, req.query);
    if (!period) {
      return res.json({ term: null, academicYear: null, weeks: [], learners: [] });
    }
    const { term, academicYear } = period;

    const result = await query(
      `SELECT l.id AS learner_id, l.full_name, l.grade, l.stream,
              w.week_number, w.quiz_score, w.typing_score, w.active_course_score
       FROM learners l
       LEFT JOIN weekly_marks w
         ON w.learner_id = l.id
        AND w.term = $2::varchar
        AND w.academic_year = $3::integer
       WHERE l.school_id = $1
         AND COALESCE(l.graduation_status, 'active') <> 'graduated'
       ORDER BY l.grade, l.stream, l.full_name, w.week_number`,
      [schoolId, term, Number(academicYear)]
    );

    const byLearner = new Map();
    const weeks = new Set();

    result.rows.forEach((row) => {
      if (!byLearner.has(row.learner_id)) {
        byLearner.set(row.learner_id, {
          learner_id: row.learner_id,
          full_name: row.full_name,
          grade: row.grade,
          stream: row.stream,
          weeks: {},
        });
      }
      if (row.week_number === null) return;
      weeks.add(row.week_number);
      byLearner.get(row.learner_id).weeks[row.week_number] = {
        quiz_score: row.quiz_score === null ? null : Number(row.quiz_score),
        typing_score: row.typing_score === null ? null : Number(row.typing_score),
        active_course_score:
          row.active_course_score === null ? null : Number(row.active_course_score),
      };
    });

    res.json({
      term,
      academicYear: Number(academicYear),
      weeks: [...weeks].sort((left, right) => left - right),
      learners: [...byLearner.values()],
    });
  } catch (error) {
    console.error("Get school weekly matrix error:", error);
    res.status(500).json({ error: error.message || "Failed to load weekly matrix" });
  }
}

module.exports = {
  getSchoolWeeklyMatrix,
  getWeeklyLeaderboard,
  getAllWeeklyLeaderboards,
  getLearnerPosition,
  getLearnerTrend,
  getTopPerformers,
  getLearnerWeeklySummary,
  getLearnerCourseProgress,
  getSchoolCourseProgress,
  getSchoolCompletionSummary,
};
