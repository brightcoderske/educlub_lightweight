const express = require("express");
const router = express.Router();
const coursesController = require("../controllers/courses.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

const canManageCourse = requireRole("system_admin", "school_admin", "teacher");

router.get("/", authenticateToken, coursesController.getAllCourses);
router.post(
  "/",
  authenticateToken,
  isSystemAdmin,
  coursesController.createCourse,
);
router.get(
  "/:id/learning-overview",
  authenticateToken,
  coursesController.getLearningOverview,
);
router.get(
  "/:courseId/modules/:moduleId/learn",
  authenticateToken,
  coursesController.getModuleLearning,
);
router.post(
  "/activities/:activityId/progress",
  authenticateToken,
  coursesController.updateActivityProgress,
);
router.get(
  "/activities/:activityId/discussion",
  authenticateToken,
  coursesController.getActivityDiscussion,
);
router.post(
  "/activities/:activityId/discussion/replies",
  authenticateToken,
  coursesController.addDiscussionReply,
);
router.post(
  "/activities/:activityId/quiz-attempts",
  authenticateToken,
  coursesController.submitQuiz,
);
router.post(
  "/:id/modules",
  authenticateToken,
  canManageCourse,
  coursesController.createModule,
);
router.post(
  "/:id/sync-template",
  authenticateToken,
  canManageCourse,
  coursesController.syncSchoolCourse,
);
router.post(
  "/:id/rollback-template",
  authenticateToken,
  canManageCourse,
  coursesController.rollbackSchoolCourse,
);
router.put(
  "/modules/:moduleId",
  authenticateToken,
  canManageCourse,
  coursesController.updateModule,
);
router.delete(
  "/modules/:moduleId",
  authenticateToken,
  canManageCourse,
  coursesController.deleteModule,
);
router.post(
  "/modules/:moduleId/activities",
  authenticateToken,
  canManageCourse,
  coursesController.createActivity,
);
router.put(
  "/activities/:activityId",
  authenticateToken,
  canManageCourse,
  coursesController.updateActivity,
);
router.delete(
  "/activities/:activityId",
  authenticateToken,
  canManageCourse,
  coursesController.deleteActivity,
);
router.get("/:id", authenticateToken, coursesController.getCourseById);
router.put(
  "/:id",
  authenticateToken,
  isSystemAdmin,
  coursesController.updateCourse,
);
router.delete(
  "/:id",
  authenticateToken,
  isSystemAdmin,
  coursesController.deleteCourse,
);

module.exports = router;
