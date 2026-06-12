const express = require("express");
const router = express.Router();
const learnersController = require("../controllers/learners.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get("/", authenticateToken, learnersController.getAllLearners);
router.post(
  "/",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  learnersController.createLearner,
);
router.post(
  "/bulk",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  learnersController.bulkCreateLearners,
);
router.post(
  "/promote",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  learnersController.promoteLearners,
);
router.get(
  "/credentials/cards",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  learnersController.downloadCredentialCards,
);
router.put(
  "/:id/reset-password",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  learnersController.resetLearnerPassword,
);
router.put(
  "/:id/graduate",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  learnersController.graduateLearner,
);
router.get("/:id", authenticateToken, learnersController.getLearnerById);
router.put("/:id", authenticateToken, learnersController.updateLearner);
router.delete(
  "/:id",
  authenticateToken,
  isSystemAdmin,
  learnersController.deleteLearner,
);

module.exports = router;
