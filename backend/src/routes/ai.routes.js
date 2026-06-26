const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/availability", authenticateToken, aiController.getAvailability);
router.get(
  "/settings",
  authenticateToken,
  requireRole("system_admin"),
  aiController.getSettings,
);
router.put(
  "/settings",
  authenticateToken,
  requireRole("system_admin"),
  aiController.updateSettings,
);
router.get(
  "/school-settings",
  authenticateToken,
  requireRole("school_admin", "teacher"),
  aiController.getSchoolSettings,
);
router.put(
  "/school-settings",
  authenticateToken,
  requireRole("school_admin"),
  aiController.updateSchoolSettings,
);
router.post(
  "/course-builder/generate",
  authenticateToken,
  requireRole("system_admin"),
  aiController.generateCourseBuilderDraft,
);
router.post(
  "/course-builder/activity",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  aiController.generateActivityContentDraft,
);
router.post(
  "/course-builder/apply",
  authenticateToken,
  requireRole("system_admin"),
  aiController.applyCourseBuilderDraft,
);

module.exports = router;
