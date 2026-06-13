const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTemplateDefinition } = require("../src/courseTemplates/templateDefinition");
const template = require("../src/courseTemplates/webDevelopment1.template");

test("shared validation does not force every template to eight modules", () => {
  const generic = {
    name: "Small Course",
    code: "SMALL",
    estimated_weeks: 1,
    learning_objectives: ["Complete one project."],
    validation_profile: "generic",
    modules: [{
      title: "Module 1",
      activities: [{
        title: "Read",
        activity_type: "lesson",
        content: { purpose: "reading", body: "Hello" },
      }],
    }],
  };

  assert.equal(validateTemplateDefinition(generic).modules.length, 1);
});

test("Web Development profile still requires eight complete missions", () => {
  assert.equal(validateTemplateDefinition(template).modules.length, 8);
  assert.throws(
    () => validateTemplateDefinition({ ...template, modules: template.modules.slice(0, 7) }),
    /eight modules/
  );
});

test("shared validation rejects positions that are not contiguous", () => {
  assert.throws(
    () => validateTemplateDefinition({
      name: "Broken Positions",
      code: "BROKEN-POSITIONS",
      estimated_weeks: 1,
      validation_profile: "generic",
      modules: [{
        title: "Module 1",
        position: 2,
        activities: [{
          title: "Read",
          activity_type: "lesson",
          content: { purpose: "reading", body: "Hello" },
        }],
      }],
    }),
    /module positions must be contiguous/
  );
});

test("shared validation does not silently replace zero positions", () => {
  assert.throws(
    () => validateTemplateDefinition({
      name: "Zero Position",
      code: "ZERO-POSITION",
      estimated_weeks: 1,
      modules: [{
        title: "Module 1",
        position: 0,
        activities: [{
          title: "Read",
          activity_type: "lesson",
          content: { purpose: "reading", body: "Hello" },
        }],
      }],
    }),
    /module positions must be contiguous/
  );
});

test("shared validation reports malformed collections clearly", () => {
  assert.throws(
    () => validateTemplateDefinition({
      name: "Broken Modules",
      code: "BROKEN-MODULES",
      estimated_weeks: 1,
      modules: {},
    }),
    /Template modules must be an array/
  );
});

test("shared validation requires activity titles", () => {
  assert.throws(
    () => validateTemplateDefinition({
      name: "Missing Activity Title",
      code: "MISSING-ACTIVITY-TITLE",
      estimated_weeks: 1,
      modules: [{
        title: "Module 1",
        activities: [{
          activity_type: "lesson",
          content: { body: "Hello" },
        }],
      }],
    }),
    /Every activity needs a title/
  );
});

test("shared validation rejects unknown profiles", () => {
  assert.throws(
    () => validateTemplateDefinition({
      name: "Unknown Profile",
      code: "UNKNOWN-PROFILE",
      estimated_weeks: 1,
      validation_profile: "missing",
      modules: [{
        title: "Module 1",
        activities: [{
          title: "Read",
          activity_type: "lesson",
          content: { body: "Hello" },
        }],
      }],
    }),
    /Unknown template validation profile missing/
  );
});

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
