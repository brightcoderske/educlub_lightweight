const express = require("express");
const typingPracticeController = require("../controllers/typingPractice.controller");
const { authenticateToken, requireRole } = require("../middleware");

const router = express.Router();

router.get(
  "/progress",
  authenticateToken,
  requireRole("learner"),
  typingPracticeController.getProgress,
);

router.post(
  "/attempts",
  authenticateToken,
  requireRole("learner"),
  typingPracticeController.submitAttempt,
);

router.get(
  "/report",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingPracticeController.report,
);

router.get(
  "/report/:learnerId/attempts",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingPracticeController.attempts,
);

module.exports = router;
