import fs from "fs";
import path from "path";

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("typing and quiz lists load in parallel while the API enforces the current period", () => {
  const source = readSource("layouts/weekly-learning/index.js");

  expect(source).toContain('apiClient.get("/academic/terms/current")');
  expect(source).toContain("const assessmentRequest =");
  expect(source).toContain("await Promise.all([");
  expect(source.indexOf("const assessmentRequest =")).toBeLessThan(
    source.indexOf("await Promise.all([")
  );
  expect(source).not.toContain('params.set("term", currentPeriod.name)');
  expect(source).not.toContain('params.set("academic_year", currentPeriod.academic_year)');
  expect(source).toContain("No current academic term");
  expect(source).toContain("strictly term-scoped");
  expect(source).toContain("expired Term 2 content will not be used as a");
  expect(source).toContain("activeAcademicTerm && (");
});

test("assessment editors and heavy performance views load independently", () => {
  const source = readSource("layouts/weekly-learning/index.js");

  expect(source).toContain('lazy(() => import("./QuizStudioForm"))');
  expect(source).toContain('lazy(() => import("./TypingStudioForm"))');
  expect(source).toContain('lazy(() => import("components/WeeklyMatrix"))');
  expect(source).toContain("performancePanel && !isLearner()");
});

test("new assessment forms never invent a fallback term", () => {
  const source = readSource("layouts/weekly-learning/weeklyLearningUtils.js");

  expect(source).not.toContain('term: "Term 1"');
  expect(source).toContain('term: ""');
  expect(source).toContain('academic_year: ""');
});
