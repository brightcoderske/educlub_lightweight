const aiSettingsService = require("../services/aiSettings.service");
const aiCourseBuilderService = require("../services/aiCourseBuilder.service");

async function getSettings(req, res, next) {
  try {
    const settings = await aiSettingsService.getAiSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const settings = await aiSettingsService.updateAiSettings(req.body, req.user);
    res.json({ message: "AI settings updated.", ...settings });
  } catch (error) {
    next(error);
  }
}

async function getSchoolSettings(req, res) {
  try {
    const settings = await aiSettingsService.getSchoolAiSettings(req.user);
    res.json(settings);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Failed to load school AI settings." });
  }
}

async function updateSchoolSettings(req, res) {
  try {
    const settings = await aiSettingsService.updateSchoolAiSettings(
      req.body,
      req.user
    );
    res.json({ message: "School AI settings updated.", ...settings });
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Failed to update school AI settings." });
  }
}

async function getAvailability(req, res, next) {
  try {
    const availability = await aiSettingsService.getAiAvailability(req.user);
    res.json(availability);
  } catch (error) {
    next(error);
  }
}

async function generateCourseBuilderDraft(req, res) {
  try {
    const draft = await aiCourseBuilderService.generateCourseBuilderDraft(
      req.body,
      req.user
    );
    res.json(draft);
  } catch (error) {
    res.status(400).json({ error: error.message || "AI generation failed." });
  }
}

async function generateActivityContentDraft(req, res) {
  try {
    const draft = await aiCourseBuilderService.generateActivityContentDraft(
      req.body,
      req.user
    );
    res.json(draft);
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "AI activity generation failed." });
  }
}

async function generateLearnerActivityExplanation(req, res) {
  try {
    const explanation =
      await aiCourseBuilderService.generateLearnerActivityExplanation(
        req.params.activityId,
        req.body,
        req.user
      );
    res.json(explanation);
  } catch (error) {
    res
      .status(400)
      .json({
        error: error.message || "eduClub AI could not explain this activity.",
      });
  }
}

async function applyCourseBuilderDraft(req, res) {
  try {
    const result = await aiCourseBuilderService.applyCourseBuilderDraft(
      req.body,
      req.user
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
  generateActivityContentDraft,
  generateCourseBuilderDraft,
  generateLearnerActivityExplanation,
  getAvailability,
  getSchoolSettings,
  getSettings,
  updateSchoolSettings,
  updateSettings,
};
