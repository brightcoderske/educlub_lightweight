const quizTestsService = require("../services/quizTests.service");

async function listTests(req, res) {
  try {
    res.json(await quizTestsService.listTests(req.user, req.query));
  } catch (error) {
    console.error("List quiz tests error:", error);
    res.status(500).json({ error: "Failed to load quiz tests" });
  }
}

async function getTest(req, res) {
  try {
    const test = await quizTestsService.getTest(req.params.id, req.user);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json(test);
  } catch (error) {
    console.error("Get quiz test error:", error);
    res.status(500).json({ error: "Failed to load quiz test" });
  }
}

async function createTest(req, res) {
  try {
    const test = await quizTestsService.createTest(req.user, req.body);
    res.status(201).json(test);
  } catch (error) {
    console.error("Create quiz test error:", error);
    res.status(400).json({ error: error.message || "Failed to create quiz test" });
  }
}

async function updateTest(req, res) {
  try {
    const test = await quizTestsService.updateTest(req.user, req.params.id, req.body);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json(test);
  } catch (error) {
    console.error("Update quiz test error:", error);
    res.status(400).json({ error: error.message || "Failed to update quiz test" });
  }
}

async function deleteTest(req, res) {
  try {
    const test = await quizTestsService.deleteTest(req.params.id);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json({ message: "Quiz setup deleted." });
  } catch (error) {
    console.error("Delete quiz test error:", error);
    res.status(400).json({ error: error.message || "Failed to delete quiz test" });
  }
}

async function submitAttempt(req, res) {
  try {
    res.status(201).json(await quizTestsService.submitAttempt(req.user, req.params.id, req.body));
  } catch (error) {
    console.error("Submit quiz test attempt error:", error);
    res.status(400).json({ error: error.message || "Failed to submit quiz" });
  }
}

async function report(req, res) {
  try {
    res.json(await quizTestsService.getReport(req.user, req.query));
  } catch (error) {
    console.error("Quiz report error:", error);
    res.status(500).json({ error: "Failed to load quiz report" });
  }
}

module.exports = {
  listTests,
  getTest,
  createTest,
  updateTest,
  deleteTest,
  submitAttempt,
  report,
};
