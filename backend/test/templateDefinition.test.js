const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTemplateDefinition } = require("../src/courseTemplates/templateDefinition");
const template = require("../src/courseTemplates/webDevelopment1.template");

test("Web Development 1 contains eight missions and eighty activities", () => {
  const result = validateTemplateDefinition(template);
  assert.equal(result.modules.length, 8);
  assert.equal(result.modules.reduce((sum, module) => sum + module.activities.length, 0), 80);
});

test("every mission follows the complete learning rhythm", () => {
  const purposes = ["welcome", "reading", "video", "discussion", "guided_practice", "build", "quiz", "level_up", "reflection", "celebration"];
  for (const module of validateTemplateDefinition(template).modules) {
    assert.deepEqual(module.activities.map((item) => item.content.purpose), purposes);
  }
});

test("every quiz includes all requested formats, hints, and explanations", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    const questions = module.activities.find((item) => item.activity_type === "quiz").content.questions;
    assert.deepEqual(questions.map((item) => item.question_type), ["multiple_choice", "matching", "short_answer", "ordering"]);
    assert.ok(questions.every((item) => item.hint && item.explanation));
  }
});

test("milestones build toward the final launch", () => {
  assert.deepEqual(validateTemplateDefinition(template).modules.map((module) =>
    module.activities.find((item) => item.content.purpose === "build").content.milestone_key
  ), ["page-skeleton", "structured-content", "links-and-images", "visual-style", "box-layout", "second-page-navigation", "tested-accessible-site", "approved-launched-site"]);
});
