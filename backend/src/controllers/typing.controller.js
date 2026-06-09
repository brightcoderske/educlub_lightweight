const typingService = require("../services/typing.service");

async function listTests(req, res) {
  try {
    const tests = await typingService.listTests(req.user, req.query);
    res.json(tests);
  } catch (error) {
    console.error("List typing tests error:", error);
    res.status(500).json({ error: "Failed to load typing tests" });
  }
}

async function getTest(req, res) {
  try {
    const test = await typingService.getTest(req.params.id, req.user);
    if (!test) {
      return res.status(404).json({ error: "Typing test not found" });
    }
    res.json(test);
  } catch (error) {
    console.error("Get typing test error:", error);
    res.status(500).json({ error: "Failed to load typing test" });
  }
}

async function createTest(req, res) {
  try {
    const test = await typingService.createTest(req.user, req.body);
    res.status(201).json(test);
  } catch (error) {
    console.error("Create typing test error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function updateTest(req, res) {
  try {
    const test = await typingService.updateTest(
      req.user,
      req.params.id,
      req.body
    );
    if (!test) {
      return res.status(404).json({ error: "Typing test not found" });
    }
    res.json(test);
  } catch (error) {
    console.error("Update typing test error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function duplicateTest(req, res) {
  try {
    const test = await typingService.duplicateTest(req.user, req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Typing test not found" });
    }
    res.status(201).json(test);
  } catch (error) {
    console.error("Duplicate typing test error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function deleteTest(req, res) {
  try {
    const test = await typingService.deleteTest(req.user, req.params.id);
    if (!test) {
      return res.status(404).json({ error: "Typing test not found" });
    }
    res.json({ message: "Typing setup deleted." });
  } catch (error) {
    console.error("Delete typing test error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function submitAttempt(req, res) {
  try {
    const attempt = await typingService.submitAttempt(
      req.user,
      req.params.lessonId,
      req.body
    );
    res.status(201).json(attempt);
  } catch (error) {
    console.error("Submit typing attempt error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function report(req, res) {
  try {
    const rows = await typingService.getReport(req.user, req.query);
    res.json(rows);
  } catch (error) {
    console.error("Typing report error:", error);
    res.status(500).json({ error: "Failed to load typing report" });
  }
}

module.exports = {
  listTests,
  getTest,
  createTest,
  updateTest,
  duplicateTest,
  deleteTest,
  submitAttempt,
  report,
};
