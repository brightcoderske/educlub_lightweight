const { query } = require("../config");
const leaderboardService = require("../services/leaderboard.service");
const courseProgressService = require("../services/courseProgress.service");
const academicService = require("../services/academic.service");

async function ensureLearnerAccess(req, learnerId) {
  if (req.user.role === "system_admin") return true;

  const result = await query(
    "SELECT school_id, user_id FROM learners WHERE id = $1",
    [learnerId]
  );
  const learner = result.rows[0];
  if (!learner) return false;

  if (req.user.role === "school_admin" || req.user.role === "teacher") {
    return learner.school_id === req.user.schoolId;
  }

  return learner.user_id === req.user.userId;
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

module.exports = {
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
