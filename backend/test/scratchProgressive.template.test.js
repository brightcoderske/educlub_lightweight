const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateTemplateDefinition } = require("../src/courseTemplates/templateDefinition");

const templates = [
  require("../src/courseTemplates/scratchExplorer.template"),
  require("../src/courseTemplates/scratchCreator.template"),
  require("../src/courseTemplates/scratchInnovator.template"),
];

const PURPOSES = [
  "overview",
  "visual_learning",
  "algorithm",
  "discussion",
  "guided_practice",
  "main_project",
  "challenge",
  "quiz",
  "reflection",
];

test("three progressive Scratch courses contain thirty complete modules", () => {
  assert.deepEqual(
    templates.map((template) => template.code),
    ["SCRATCH-EXPLORER", "SCRATCH-CREATOR", "SCRATCH-INNOVATOR"],
  );

  const validated = templates.map(validateTemplateDefinition);
  assert.ok(validated.every((template) => template.modules.length === 10));
  assert.equal(
    validated.flatMap((template) => template.modules).reduce(
      (total, module) => total + module.activities.length,
      0,
    ),
    270,
  );
});

test("every progressive module contains real learning, discussion, projects, and assessment", () => {
  for (const template of templates.map(validateTemplateDefinition)) {
    for (const module of template.modules) {
      assert.deepEqual(
        module.activities.map((activity) => activity.content.purpose),
        PURPOSES,
      );

      const [overview, visual, algorithm, discussion, practice, project, challenge, quiz, reflection] =
        module.activities;

      assert.ok(overview.content.learning_objectives.length >= 4);
      assert.ok(overview.content.vocabulary.length >= 4);
      assert.ok(overview.content.guided_notes.length >= 4);
      assert.equal(overview.content.session_plan.length, 5);
      assert.ok(visual.content.body.length >= 180);
      assert.ok(algorithm.content.algorithm_steps.length >= 5);

      assert.ok(discussion.content.discussion_prompt.length >= 40);
      assert.ok(discussion.content.questions.length >= 3);
      assert.ok(discussion.content.sentence_starters.length >= 2);
      assert.ok(discussion.content.moderation_notes.length >= 40);
      assert.ok(discussion.content.description.includes(discussion.content.questions[0]));
      assert.ok(discussion.content.description.includes(discussion.content.sentence_starters[0]));

      assert.ok(practice.content.project_brief.length >= 50);
      assert.ok(practice.content.steps.length >= 5);
      assert.ok(practice.content.success_checks.length >= 3);
      assert.ok(practice.content.debugging_hints.length >= 3);

      assert.equal(project.content.project_choices.length, 2);
      for (const choice of project.content.project_choices) {
        assert.ok(choice.title.length >= 4);
        assert.ok(choice.brief.length >= 60);
        assert.ok(choice.build_steps.length >= 5);
        assert.ok(choice.success_checks.length >= 4);
        assert.ok(project.content.body.includes(choice.title));
        assert.ok(project.content.body.includes(choice.brief));
      }

      assert.ok(challenge.content.project_brief.length >= 50);
      assert.ok(challenge.content.steps.length >= 3);
      assert.ok(challenge.content.success_checks.length >= 3);

      assert.equal(quiz.content.questions.length, 5);
      assert.equal(quiz.pass_score, 80);
      for (const question of quiz.content.questions) {
        assert.equal(question.question_type, "multiple_choice");
        assert.equal(question.options.length, 4);
        assert.ok(question.options.includes(question.correct_answer));
        assert.ok(question.hint.length >= 20);
        assert.ok(question.explanation.length >= 30);
      }

      assert.ok(reflection.content.prompts.length >= 4);
      assert.ok(reflection.content.submission_accept.includes(".sb3"));
      assert.match(reflection.content.submission_instructions, /\.sb3/i);
      assert.ok(module.teacher_notes.length >= 350);
    }
  }
});

test("new pathway provides sixty project choices, thirty discussions, and 150 quiz questions", () => {
  const modules = templates.flatMap((template) => validateTemplateDefinition(template).modules);
  assert.equal(modules.length, 30);
  assert.equal(modules.filter((module) =>
    module.activities.some((activity) => activity.activity_type === "discussion")
  ).length, 30);
  assert.equal(modules.reduce((total, module) =>
    total + module.activities[5].content.project_choices.length, 0), 60);
  assert.equal(modules.reduce((total, module) =>
    total + module.activities[7].content.questions.length, 0), 150);
});

test("AI learning includes safeguards and a Scratch-only alternative", () => {
  const aiModules = templates
    .slice(1)
    .flatMap((template) => template.modules)
    .filter((module) => module.ai_focus);

  assert.ok(aiModules.length >= 5);
  for (const module of aiModules) {
    const text = JSON.stringify(module).toLowerCase();
    assert.match(text, /privacy|private/);
    assert.match(text, /test/);
    assert.match(text, /limit/);
    assert.match(text, /human|learner|teacher/);
    assert.match(text, /scratch-only|without an external ai tool/);
  }
});

test("the existing Scratch Intermediate course remains available", () => {
  const intermediate = require("../src/courseTemplates/scratchIntermediate.template");
  const validated = validateTemplateDefinition(intermediate);
  assert.equal(validated.code, "SCRATCH-INTERMEDIATE");
  assert.equal(validated.modules.length, 10);
});

test("every progressive course cover and roadmap asset exists", () => {
  for (const template of templates) {
    for (const imageUrl of [template.image_url, template.settings.roadmap_image_url]) {
      assert.equal(
        fs.existsSync(path.join(__dirname, "../../frontend/public", imageUrl)),
        true,
        `Missing ${imageUrl}`,
      );
    }
  }
});
