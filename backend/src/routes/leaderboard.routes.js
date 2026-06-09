const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboard.controller");
const {
  authenticateToken,
  isSchoolAdmin,
  isSystemAdmin,
} = require("../middleware");

// Get weekly leaderboard for specific category
router.get(
  "/weekly/:weekNumber/:term/:academicYear/:category",
  authenticateToken,
  isSchoolAdmin,
  leaderboardController.getWeeklyLeaderboard
);

// Get all weekly leaderboards (quiz, typing, active_course) for a week
router.get(
  "/weekly/:weekNumber/:term/:academicYear/all",
  authenticateToken,
  isSchoolAdmin,
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
  isSchoolAdmin,
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
  isSchoolAdmin,
  leaderboardController.getSchoolCourseProgress
);

// Get school-wide completion summary from cached learner course progress.
router.get(
  "/school-completion-summary",
  authenticateToken,
  isSchoolAdmin,
  leaderboardController.getSchoolCompletionSummary
);

module.exports = router;
