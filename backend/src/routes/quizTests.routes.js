const express = require("express");
const quizTestsController = require("../controllers/quizTests.controller");
const { authenticateToken, requireRole } = require("../middleware");

const router = express.Router();

router.get("/tests", authenticateToken, quizTestsController.listTests);
router.get("/tests/:id", authenticateToken, quizTestsController.getTest);
router.post(
  "/tests",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.createTest,
);
router.put(
  "/tests/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.updateTest,
);
router.post(
  "/tests/:id/duplicate",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.duplicateTest,
);
router.delete(
  "/tests/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.deleteTest,
);
router.post(
  "/tests/:id/attempts",
  authenticateToken,
  requireRole("learner"),
  quizTestsController.submitAttempt,
);
router.get(
  "/tests/:id/attempts",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.attemptReview,
);
router.put(
  "/attempts/:attemptId/marks",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.updateAttemptMarks,
);
router.get(
  "/report",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  quizTestsController.report,
);

module.exports = router;
