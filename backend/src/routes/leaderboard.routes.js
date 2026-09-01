const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboard.controller");
const { authenticateToken, requireRole } = require("../middleware");

// Named for what it actually allows. The old isSchoolAdmin() helper admitted
// teachers too, so every route here read as tighter than it was.
const isSchoolStaff = requireRole("school_admin", "teacher");

// Get weekly leaderboard for specific category
router.get(
  "/weekly/:weekNumber/:term/:academicYear/:category",
  authenticateToken,
  isSchoolStaff,
  leaderboardController.getWeeklyLeaderboard
);

// Get all weekly leaderboards (quiz, typing, active_course) for a week
router.get(
  "/weekly/:weekNumber/:term/:academicYear/all",
  authenticateToken,
  isSchoolStaff,
  leaderboardController.getAllWeeklyLeaderboards
);

// Get learner's position in leaderboard
router.get(
  "/position/:learnerId/:weekNumber/:term/:academicYear/:category",
  authenticateToken,
  leaderboardController.getLearnerPosition
);

// Get learner's performance trend (improvement/drop)
router.get(
  "/trend/:learnerId/:term/:academicYear/:category",
  authenticateToken,
  leaderboardController.getLearnerTrend
);

// Get top performers for a category
router.get(
  "/top/:term/:academicYear/:category",
  authenticateToken,
  isSchoolStaff,
  leaderboardController.getTopPerformers
);

// Get learner's weekly performance summary
router.get(
  "/summary/:learnerId/:term/:academicYear",
  authenticateToken,
  leaderboardController.getLearnerWeeklySummary
);

// Get live/cached module progress for the learner's active courses
router.get(
  "/course-progress/:learnerId",
  authenticateToken,
  leaderboardController.getLearnerCourseProgress
);

// Get module progress for learners allocated to a course in the school.
router.get(
  "/school-course-progress",
  authenticateToken,
  isSchoolStaff,
  leaderboardController.getSchoolCourseProgress
);

// Whole-cohort weekly marks matrix: learners as rows, week numbers as columns.
router.get(
  "/school-weekly-matrix",
  authenticateToken,
  // The handler reads req.query.schoolId for a system administrator, so it is
  // written to serve one; the guard was refusing the role the code supports.
  requireRole("system_admin", "school_admin", "teacher"),
  leaderboardController.getSchoolWeeklyMatrix
);

// Get school-wide completion summary from cached learner course progress.
router.get(
  "/school-completion-summary",
  authenticateToken,
  isSchoolStaff,
  leaderboardController.getSchoolCompletionSummary
);

module.exports = router;
