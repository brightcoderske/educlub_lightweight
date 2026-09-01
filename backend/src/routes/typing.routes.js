const express = require("express");
const router = express.Router();
const typingController = require("../controllers/typing.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/tests", authenticateToken, typingController.listTests);
router.get("/tests/:id", authenticateToken, typingController.getTest);
router.post(
  "/tests",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingController.createTest
);
router.put(
  "/tests/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingController.updateTest
);
router.post(
  "/tests/:id/duplicate",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingController.duplicateTest
);
router.delete(
  "/tests/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingController.deleteTest
);
router.post(
  "/lessons/:lessonId/attempts",
  authenticateToken,
  requireRole("learner"),
  typingController.submitAttempt
);
router.get(
  "/report",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  typingController.report
);

module.exports = router;
