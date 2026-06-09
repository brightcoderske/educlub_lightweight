const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reports.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/", authenticateToken, reportsController.getAllReports);
router.get(
  "/learner/:learnerId",
  authenticateToken,
  reportsController.getLearnerReports
);
router.get(
  "/school/:schoolId",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  reportsController.getSchoolReports
);
router.get(
  "/course/:courseId",
  authenticateToken,
  reportsController.getCourseReports
);
router.post("/", authenticateToken, reportsController.generateReport);
router.get(
  "/feedback/:learnerId",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  reportsController.getReportFeedback
);
router.put(
  "/feedback/:learnerId",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  reportsController.saveReportFeedback
);

// PDF Report Generation Routes
router.get(
  "/pdf/:learnerId/:term/:academicYear",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  reportsController.generateLearnerReportPDF
);
router.post(
  "/pdf/class",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  reportsController.generateClassReportsPDF
);
router.post(
  "/pdf/school",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  reportsController.generateSchoolReportsPDF
);

module.exports = router;
