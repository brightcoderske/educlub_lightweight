const express = require("express");
const router = express.Router();
const schoolsController = require("../controllers/schools.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get("/", authenticateToken, schoolsController.getAllSchools);
router.post(
  "/",
  authenticateToken,
  isSystemAdmin,
  schoolsController.createSchool
);
router.post(
  "/logo",
  authenticateToken,
  isSystemAdmin,
  schoolsController.uploadSchoolLogo
);
router.get("/:id/learners", authenticateToken, isSystemAdmin, schoolsController.getSchoolLearners);
router.get(
  "/:id/learners/export",
  authenticateToken,
  isSystemAdmin,
  schoolsController.exportSchoolLearners
);
router.get("/:id", authenticateToken, schoolsController.getSchoolById);
router.put(
  "/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  schoolsController.updateSchool
);
router.delete(
  "/:id",
  authenticateToken,
  isSystemAdmin,
  schoolsController.deleteSchool
);

module.exports = router;
