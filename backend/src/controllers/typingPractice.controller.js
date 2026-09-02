const typingPracticeService = require("../services/typingPractice.service");

async function getProgress(req, res) {
  try {
    const progress = await typingPracticeService.getProgress(req.user);
    res.json(progress);
  } catch (error) {
    console.error("Typing practice progress error:", error);
    res.status(400).json({
      error: error.message || "Failed to load typing practice progress.",
    });
  }
}

async function submitAttempt(req, res) {
  try {
    const attempt = await typingPracticeService.submitAttempt(
      req.user,
      req.body,
    );
    res.status(201).json(attempt);
  } catch (error) {
    console.error("Typing practice attempt error:", error);
    res.status(400).json({
      error: error.message || "Failed to save typing practice attempt.",
    });
  }
}

async function report(req, res) {
  try {
    const rows = await typingPracticeService.getReport(req.user, req.query);
    res.json(rows);
  } catch (error) {
    console.error("Typing practice report error:", error);
    res.status(400).json({
      error: error.message || "Failed to load typing practice report.",
    });
  }
}

async function attempts(req, res) {
  try {
    res.json(await typingPracticeService.getAttempts(req.user, req.params.learnerId, req.query));
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to load typing activity log." });
  }
}

module.exports = {
  getProgress,
  submitAttempt,
  report,
  attempts,
};
