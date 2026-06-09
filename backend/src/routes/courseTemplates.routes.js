const express = require("express");
const router = express.Router();
const controller = require("../controllers/courseTemplates.controller");
const {
  authenticateToken,
  isSystemAdmin,
  isSchoolAdmin,
} = require("../middleware");

router.get("/", authenticateToken, controller.listTemplates);
router.post("/", authenticateToken, isSystemAdmin, controller.createTemplate);
router.get(
  "/:templateId/builder",
  authenticateToken,
  controller.getTemplateBuilder,
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
  isSchoolAdmin,
  controller.adoptTemplate,
);

module.exports = router;
