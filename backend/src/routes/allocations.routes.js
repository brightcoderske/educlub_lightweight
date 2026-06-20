const express = require("express");
const router = express.Router();
const allocationsController = require("../controllers/allocations.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.get("/", authenticateToken, allocationsController.getAllAllocations);
router.post(
  "/",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  allocationsController.createAllocation
);
router.get("/:id", authenticateToken, allocationsController.getAllocationById);
router.put(
  "/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  allocationsController.updateAllocation
);
router.delete(
  "/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  allocationsController.deleteAllocation
);
router.post(
  "/bulk",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  allocationsController.bulkAllocate
);
router.post(
  "/:id/manual-access",
  authenticateToken,
  requireRole("system_admin"),
  allocationsController.grantManualAccess
);

module.exports = router;
