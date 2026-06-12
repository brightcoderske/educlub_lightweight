const express = require("express");
const controller = require("../controllers/teacherAssignments.controller");
const { authenticateToken, requireRole } = require("../middleware");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  controller.list,
);
router.post(
  "/",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  controller.assign,
);
router.delete(
  "/:assignmentId",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  controller.deallocate,
);
router.post(
  "/courses/:courseId/update-requests",
  authenticateToken,
  requireRole("teacher"),
  controller.requestTemplateUpdate,
);

module.exports = router;
