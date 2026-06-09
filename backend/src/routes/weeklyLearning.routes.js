const express = require("express");
const router = express.Router();
const weeklyLearningController = require("../controllers/weeklyLearning.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/", authenticateToken, weeklyLearningController.getWeeklyCourses);
router.post(
  "/sync-results",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  weeklyLearningController.syncWeeklyResults
);

module.exports = router;
