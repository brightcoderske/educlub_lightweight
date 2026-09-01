const quizTestsService = require("../services/quizTests.service");

// Ownership refusals from the assessment policy are an authorisation answer,
// not a malformed request, so they must not be flattened into a 400.
function writeStatus(error) {
  if (error.statusCode) return error.statusCode;
  return /another school|read-only|not linked to a school|cannot author/i.test(
    error.message || "",
  )
    ? 403
    : 400;
}

async function listTests(req, res) {
  try {
    res.json(await quizTestsService.listTests(req.user, req.query));
  } catch (error) {
    console.error("List quiz tests error:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load quiz tests" });
  }
}

async function getTest(req, res) {
  try {
    const test = await quizTestsService.getTest(req.params.id, req.user, req.query);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json(test);
  } catch (error) {
    console.error("Get quiz test error:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load quiz test" });
  }
}

async function createTest(req, res) {
  try {
    const test = await quizTestsService.createTest(req.user, req.body);
    res.status(201).json(test);
  } catch (error) {
    console.error("Create quiz test error:", error);
    res
      .status(writeStatus(error))
      .json({ error: error.message || "Failed to create quiz test" });
  }
}

async function updateTest(req, res) {
  try {
    const test = await quizTestsService.updateTest(
      req.user,
      req.params.id,
      req.body,
    );
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json(test);
  } catch (error) {
    console.error("Update quiz test error:", error);
    res
      .status(writeStatus(error))
      .json({ error: error.message || "Failed to update quiz test" });
  }
}

async function duplicateTest(req, res) {
  try {
    const test = await quizTestsService.duplicateTest(req.user, req.params.id);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.status(201).json(test);
  } catch (error) {
    console.error("Duplicate quiz test error:", error);
    res
      .status(writeStatus(error))
      .json({ error: error.message || "Failed to duplicate quiz test" });
  }
}

async function deleteTest(req, res) {
  try {
    const test = await quizTestsService.deleteTest(req.user, req.params.id);
    if (!test) return res.status(404).json({ error: "Quiz not found" });
    res.json({ message: "Quiz setup deleted." });
  } catch (error) {
    console.error("Delete quiz test error:", error);
    res
      .status(writeStatus(error))
      .json({ error: error.message || "Failed to delete quiz test" });
  }
}

async function submitAttempt(req, res) {
  try {
    res
      .status(201)
      .json(
        await quizTestsService.submitAttempt(req.user, req.params.id, req.body),
      );
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
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load quiz report" });
  }
}

async function attemptReview(req, res) {
  try {
    const review = await quizTestsService.getAttemptReview(
      req.user,
      req.params.id,
      req.query,
    );
    if (!review) return res.status(404).json({ error: "Quiz not found" });
    res.json(review);
  } catch (error) {
    console.error("Quiz attempt review error:", error);
    res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Failed to load quiz attempts" });
  }
}

async function updateAttemptMarks(req, res) {
  try {
    const attempt = await quizTestsService.updateAttemptMarks(
      req.user,
      req.params.attemptId,
      req.body,
      req.query,
    );
    if (!attempt) return res.status(404).json({ error: "Quiz attempt not found" });
    res.json(attempt);
  } catch (error) {
    console.error("Update quiz attempt marks error:", error);
    res.status(400).json({ error: error.message || "Failed to update marks" });
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
  attemptReview,
  updateAttemptMarks,
};
