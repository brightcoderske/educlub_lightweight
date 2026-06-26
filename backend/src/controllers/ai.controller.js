const aiSettingsService = require("../services/aiSettings.service");
const aiCourseBuilderService = require("../services/aiCourseBuilder.service");

async function getSettings(req, res) {
  const settings = await aiSettingsService.getAiSettings();
  res.json(settings);
}

async function updateSettings(req, res) {
  const settings = await aiSettingsService.updateAiSettings(req.body, req.user);
  res.json({ message: "AI settings updated.", ...settings });
}

async function getAvailability(req, res) {
  const availability = await aiSettingsService.getAiAvailability(req.user);
  res.json(availability);
}

async function generateCourseBuilderDraft(req, res) {
  try {
    const draft = await aiCourseBuilderService.generateCourseBuilderDraft(
      req.body,
      req.user,
    );
    res.json(draft);
  } catch (error) {
    res.status(400).json({ error: error.message || "AI generation failed." });
  }
}

async function applyCourseBuilderDraft(req, res) {
  try {
    const result = await aiCourseBuilderService.applyCourseBuilderDraft(
      req.body,
      req.user,
    );
    res.status(201).json(result);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Failed to insert AI draft." });
  }
}

module.exports = {
  applyCourseBuilderDraft,
  generateCourseBuilderDraft,
  getAvailability,
  getSettings,
  updateSettings,
};
