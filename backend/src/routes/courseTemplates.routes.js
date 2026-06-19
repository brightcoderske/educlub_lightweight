const express = require("express");
const router = express.Router();
const controller = require("../controllers/courseTemplates.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get("/", authenticateToken, controller.listTemplates);
router.post("/", authenticateToken, isSystemAdmin, controller.createTemplate);
router.get(
  "/:templateId/builder",
  authenticateToken,
  controller.getTemplateBuilder,
);
router.get(
  "/:templateId/learning-overview",
  authenticateToken,
  isSystemAdmin,
  controller.getTemplateLearningOverview,
);
router.get(
  "/:templateId/modules/:moduleId/learn",
  authenticateToken,
  isSystemAdmin,
  controller.getTemplateModuleLearning,
);
router.get(
  "/:templateId/modules/:moduleId/pdf",
  authenticateToken,
  isSystemAdmin,
  controller.downloadTemplateModulePdf,
);
router.put(
  "/:templateId",
  authenticateToken,
  isSystemAdmin,
  controller.updateTemplate,
);
router.post(
  "/:templateId/modules",
  authenticateToken,
  isSystemAdmin,
  controller.createTemplateModule,
);
router.put(
  "/modules/:moduleId",
  authenticateToken,
  isSystemAdmin,
  controller.updateTemplateModule,
);
router.delete(
  "/modules/:moduleId",
  authenticateToken,
  isSystemAdmin,
  controller.deleteTemplateModule,
);
router.post(
  "/modules/:moduleId/activities",
  authenticateToken,
  isSystemAdmin,
  controller.createTemplateActivity,
);
router.put(
  "/modules/:moduleId/activities/order",
  authenticateToken,
  isSystemAdmin,
  controller.reorderTemplateActivities,
);
router.put(
  "/activities/:activityId",
  authenticateToken,
  isSystemAdmin,
  controller.updateTemplateActivity,
);
router.delete(
  "/activities/:activityId",
  authenticateToken,
  isSystemAdmin,
  controller.deleteTemplateActivity,
);
router.post(
  "/:templateId/adopt",
  authenticateToken,
  requireRole("school_admin"),
  controller.adoptTemplate,
);

module.exports = router;
