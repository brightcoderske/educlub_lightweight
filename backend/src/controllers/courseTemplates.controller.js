const courseTemplatesService = require("../services/courseTemplates.service");
const { writeModulePdf } = require("../services/modulePdf.service");

async function listTemplates(req, res) {
  try {
    const templates = await courseTemplatesService.listTemplates(
      req.query,
      req.user,
    );
    res.json(templates);
  } catch (error) {
    console.error("List course templates error:", error);
    res.status(500).json({ error: "Failed to list course templates" });
  }
}

async function createTemplate(req, res) {
  try {
    const template = await courseTemplatesService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    console.error("Create course template error:", error);
    res.status(500).json({ error: "Failed to create course template" });
  }
}

async function updateTemplate(req, res) {
  try {
    const template = await courseTemplatesService.updateTemplate(
      req.params.templateId,
      req.body,
    );
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    console.error("Update course template error:", error);
    res.status(500).json({ error: "Failed to update course template" });
  }
}

async function getTemplateBuilder(req, res) {
  try {
    const builder = await courseTemplatesService.getTemplateBuilder(
      req.params.templateId,
    );
    if (!builder) return res.status(404).json({ error: "Template not found" });
    res.json(builder);
  } catch (error) {
    console.error("Get template builder error:", error);
    res.status(500).json({ error: "Failed to load template builder" });
  }
}

async function getTemplateLearningOverview(req, res) {
  try {
    const overview =
      await courseTemplatesService.getTemplateLearningOverview(
        req.params.templateId,
      );
    if (!overview) return res.status(404).json({ error: "Template not found" });
    res.json(overview);
  } catch (error) {
    console.error("Get template learning overview error:", error);
    res.status(500).json({ error: "Failed to get template learning overview" });
  }
}

async function getTemplateModuleLearning(req, res) {
  try {
    const moduleLearning =
      await courseTemplatesService.getTemplateModuleLearning(
        req.params.templateId,
        req.params.moduleId,
      );
    if (!moduleLearning) {
      return res.status(404).json({ error: "Template module not found" });
    }
    res.json(moduleLearning);
  } catch (error) {
    console.error("Get template module learning error:", error);
    res.status(500).json({ error: "Failed to get template module learning" });
  }
}

async function downloadTemplateModulePdf(req, res) {
  try {
    const moduleLearning =
      await courseTemplatesService.getTemplateModuleLearning(
        req.params.templateId,
        req.params.moduleId,
      );
    if (!moduleLearning) {
      return res.status(404).json({ error: "Template module not found" });
    }
    writeModulePdf(res, moduleLearning);
  } catch (error) {
    console.error("Download template module PDF error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create module PDF" });
    }
  }
}

async function createTemplateModule(req, res) {
  try {
    const module = await courseTemplatesService.createTemplateModule(
      req.params.templateId,
      req.body,
    );
    res.status(201).json(module);
  } catch (error) {
    console.error("Create template module error:", error);
    res.status(500).json({ error: "Failed to create module" });
  }
}

async function updateTemplateModule(req, res) {
  try {
    const module = await courseTemplatesService.updateTemplateModule(
      req.params.moduleId,
      req.body,
    );
    if (!module) return res.status(404).json({ error: "Module not found" });
    res.json(module);
  } catch (error) {
    console.error("Update template module error:", error);
    res.status(500).json({ error: "Failed to update module" });
  }
}

async function deleteTemplateModule(req, res) {
  try {
    await courseTemplatesService.deleteTemplateModule(req.params.moduleId);
    res.json({ message: "Module deleted" });
  } catch (error) {
    console.error("Delete template module error:", error);
    res.status(500).json({ error: "Failed to delete module" });
  }
}

async function createTemplateActivity(req, res) {
  try {
    const activity = await courseTemplatesService.createTemplateActivity(
      req.params.moduleId,
      req.body,
    );
    res.status(201).json(activity);
  } catch (error) {
    console.error("Create template activity error:", error);
    res.status(500).json({ error: "Failed to create activity" });
  }
}

async function updateTemplateActivity(req, res) {
  try {
    const activity = await courseTemplatesService.updateTemplateActivity(
      req.params.activityId,
      req.body,
    );
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    res.json(activity);
  } catch (error) {
    console.error("Update template activity error:", error);
    res.status(500).json({ error: "Failed to update activity" });
  }
}

async function deleteTemplateActivity(req, res) {
  try {
    await courseTemplatesService.deleteTemplateActivity(req.params.activityId);
    res.json({ message: "Activity deleted" });
  } catch (error) {
    console.error("Delete template activity error:", error);
    res.status(500).json({ error: "Failed to delete activity" });
  }
}

async function adoptTemplate(req, res) {
  try {
    const course = await courseTemplatesService.adoptTemplate(
      req.params.templateId,
      req.user,
    );
    res.status(201).json(course);
  } catch (error) {
    console.error("Adopt course template error:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to adopt template" });
  }
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  getTemplateBuilder,
  getTemplateLearningOverview,
  getTemplateModuleLearning,
  downloadTemplateModulePdf,
  createTemplateModule,
  updateTemplateModule,
  deleteTemplateModule,
  createTemplateActivity,
  updateTemplateActivity,
  deleteTemplateActivity,
  adoptTemplate,
};
