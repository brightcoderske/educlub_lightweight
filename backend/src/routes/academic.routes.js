const express = require("express");
const router = express.Router();
const academicController = require("../controllers/academic.controller");
const { authenticateToken, isSystemAdmin } = require("../middleware");

// Academic Years
router.get("/years", authenticateToken, academicController.getAllAcademicYears);
router.post(
  "/years",
  authenticateToken,
  isSystemAdmin,
  academicController.createAcademicYear
);
router.get(
  "/years/:id",
  authenticateToken,
  academicController.getAcademicYearById
);
router.put(
  "/years/:id",
  authenticateToken,
  isSystemAdmin,
  academicController.updateAcademicYear
);
router.delete(
  "/years/:id",
  authenticateToken,
  isSystemAdmin,
  academicController.deleteAcademicYear
);

// Terms
router.get("/terms", authenticateToken, academicController.getAllTerms);
router.get(
  "/terms/current",
  authenticateToken,
  academicController.getCurrentTerm
);
router.post(
  "/terms",
  authenticateToken,
  isSystemAdmin,
  academicController.createTerm
);
router.get("/terms/:id", authenticateToken, academicController.getTermById);
router.put(
  "/terms/:id",
  authenticateToken,
  isSystemAdmin,
  academicController.updateTerm
);
router.delete(
  "/terms/:id",
  authenticateToken,
  isSystemAdmin,
  academicController.deleteTerm
);

// Term Weeks
router.get(
  "/terms/:termId/weeks",
  authenticateToken,
  academicController.getTermWeeks
);
router.post(
  "/terms/:termId/weeks/calculate",
  authenticateToken,
  isSystemAdmin,
  academicController.calculateTermWeeks
);

module.exports = router;
