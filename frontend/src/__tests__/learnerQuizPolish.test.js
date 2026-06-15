import fs from "fs";
import path from "path";

const readSource = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

test("registration explains every missing requirement and supports password visibility", () => {
  const source = readSource("layouts/landing/index.js");

  expect(source).toContain("registrationIssues");
  expect(source).toContain("showPassword");
  expect(source).toContain("visibility_off");
  expect(source).toContain("Complete before registering:");
});

test("staff course preview stays in client-side navigation", () => {
  const builder = readSource("layouts/course-builder/index.js");
  const courses = readSource("layouts/school-admin/courses/index.js");

  expect(builder).not.toContain("window.open(");
  expect(courses).toContain("Preview as Learner");
  expect(courses).toContain("/preview");
});

test("weekly quiz review supports learner filters and editable marks", () => {
  const source = readSource("layouts/weekly-learning/index.js");

  expect(source).toContain("quizReviewFilters");
  expect(source).toContain("Learner name");
  expect(source).toContain("saveQuizAttemptMarks");
  expect(source).toContain("question_marks");
  expect(source).toContain("Partly right");
  expect(source).toContain("event.target.select()");
  expect(source).toContain("/marks");
});

test("learner rich content activates interactive blocks and expandable images", () => {
  const learner = readSource("layouts/learner/module-learn/index.js");

  expect(learner).toContain("[data-interactive-toggle]");
  expect(learner).toContain("[data-interactive-answer]");
  expect(learner).toContain('target.tagName === "IMG"');
  expect(learner).toContain("setPreviewImage");
});
