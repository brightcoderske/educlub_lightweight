import fs from "fs";
import path from "path";

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("quiz authoring follows the reference studio structure", () => {
  const source = readSource("layouts/weekly-learning/QuizStudioForm.js");

  [
    "Create New Quiz",
    "Save as Draft",
    "Publish Quiz",
    "Quiz Details",
    "Questions",
    "Settings",
    "Review",
    "Question List",
    "Live Preview",
    "Quiz Settings",
  ].forEach((label) => expect(source).toContain(label));
});

test("typing authoring keeps the same studio structure but separate content", () => {
  const source = readSource("layouts/weekly-learning/TypingStudioForm.js");

  [
    "Create New Typing Test",
    "Save as Draft",
    "Publish Typing Test",
    "Test Details",
    "Lessons",
    "Settings",
    "Review",
    "Lesson List",
    "Live Preview",
    "Typing Settings",
  ].forEach((label) => expect(source).toContain(label));
});

test("quiz names open performance and typing stays in its own library", () => {
  const source = readSource("layouts/weekly-learning/AssessmentLibrary.js");

  expect(source).toContain("onOpenQuizPerformance(test)");
  expect(source).toContain("View performance for");
  expect(source).toContain('title="Quizzes"');
  expect(source).toContain('title="Typing tests"');
});
