const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateTemplateDefinition } = require("../src/courseTemplates/templateDefinition");
const template = require("../src/courseTemplates/scratchIntermediate.template");

const PURPOSES = [
  "overview",
  "visual_learning",
  "algorithm",
  "guided_practice",
  "main_project",
  "challenge",
  "quiz",
  "reflection",
];

const THEMES = [
  "Interactive Story Studio",
  "Maze Game Designer",
  "Catch and Score",
  "Clone Attack",
  "Quiz Show Challenge",
  "Animation and Music Lab",
  "Smart Pet Simulator",
  "Drawing Machine",
  "Eco-System Simulation",
  "Portfolio Capstone",
];

const HERO_ASSETS = [
  "module-01-story.webp",
  "module-02-maze.webp",
  "module-03-catch.webp",
  "module-04-clones.webp",
  "module-05-quiz.webp",
  "module-06-animation.webp",
  "module-07-pet.webp",
  "module-08-drawing.webp",
  "module-09-ecosystem.webp",
  "module-10-capstone.webp",
];

test("Scratch Intermediate validates as ten modules and eighty activities", () => {
  const result = validateTemplateDefinition(template);

  assert.equal(result.code, "SCRATCH-INTERMEDIATE");
  assert.equal(result.validation_profile, "scratch_intermediate");
  assert.equal(result.modules.length, 10);
  assert.equal(
    result.modules.reduce((total, module) => total + module.activities.length, 0),
    80
  );
  assert.deepEqual(result.modules.map((module) => module.title), THEMES);
});

test("every module follows the required eight-activity learning rhythm", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    assert.equal(module.activities.length, 8);
    assert.deepEqual(
      module.activities.map((activity) => activity.content.purpose),
      PURPOSES
    );
    assert.deepEqual(
      module.activities.map((activity) => activity.activity_type),
      ["lesson", "lesson", "coding", "coding", "project", "assignment", "quiz", "reflection"]
    );
    assert.equal(module.activities[4].is_required, true);
    assert.equal(module.activities[5].is_required, false);
  }
});

test("modules contain SMART objectives and rich learner and teacher guidance", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    assert.ok(module.learning_objectives.length >= 4);
    assert.ok(module.teacher_notes.length >= 300);
    assert.match(module.teacher_notes, /Project feedback rubric:/);
    assert.match(module.teacher_notes, /Growing:|Ready:|Excellent:/);

    const [overview, visual, algorithm, practice, project] = module.activities;
    assert.ok(overview.content.concepts.length >= 4);
    assert.ok(overview.content.guided_notes.length >= 4);
    assert.ok(visual.content.guided_notes.length >= 4);
    assert.ok(algorithm.content.algorithm_steps.length >= 5);
    assert.ok(practice.content.friendly_hints.length >= 3);
    assert.ok(project.content.success_checks.length >= 4);
    assert.match(overview.content.body, /Learning objectives:/);
    assert.match(visual.content.body, /Key concepts:/);
    assert.match(algorithm.content.body, /Algorithm steps:/);
    assert.match(practice.content.body, /Success checks:/);
    assert.match(project.content.body, /Build steps:/);
    assert.match(module.activities[5].content.body, /Success checks:/);
    assert.match(module.activities[7].content.body, /Reflection prompts:/);
    assert.equal(practice.content.body.includes(practice.content.description), false);
    assert.equal(project.content.body.includes(project.content.project_brief), false);
  }
});

test("course and module visuals use predictable local assets with alt text", () => {
  assert.equal(template.image_url, "/course-assets/scratch-intermediate/course-cover.webp");
  assert.equal(
    template.settings.roadmap_image_url,
    "/course-assets/scratch-intermediate/course-roadmap.webp"
  );
  assert.ok(template.settings.roadmap_image_alt);

  for (const [index, module] of validateTemplateDefinition(template).modules.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const media = module.activities
      .flatMap((activity) => activity.content.media ? [activity.content.media] : []);

    assert.ok(media.some((item) =>
      item.image_url === `/course-assets/scratch-intermediate/${HERO_ASSETS[index]}`
    ));
    assert.ok(media.some((item) =>
      item.image_url === `/course-assets/scratch-intermediate/module-${number}-algorithm.webp`
    ));
    assert.ok(media.every((item) => item.image_alt?.trim()));
    assert.equal(media.filter((item) =>
      item.image_url === `/course-assets/scratch-intermediate/${HERO_ASSETS[index]}`
    ).length, 1);
  }
});

test("every declared Scratch image exists in the frontend public assets", () => {
  const imageUrls = new Set([
    template.image_url,
    template.settings.roadmap_image_url,
    ...template.modules.flatMap((module) =>
      module.activities
        .map((activity) => activity.content.media?.image_url)
        .filter(Boolean)
    ),
  ]);

  for (const imageUrl of imageUrls) {
    assert.equal(
      fs.existsSync(path.join(__dirname, "../../frontend/public", imageUrl)),
      true,
      `Missing ${imageUrl}`
    );
  }
});

test("every quiz has five multiple-choice questions with mastery support", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    const quiz = module.activities[6];
    assert.equal(quiz.pass_score, 80);
    assert.equal(quiz.content.unlimited_retries, true);
    assert.equal(quiz.content.questions.length, 5);
    assert.ok(quiz.content.questions.every((question) =>
      question.question_type === "multiple_choice" &&
      question.options.length === 4 &&
      question.options.filter((option) => option === question.correct_answer).length === 1 &&
      question.hint?.trim() &&
      question.explanation?.trim()
    ));
    assert.equal(
      new Set(quiz.content.questions.map((question) => question.id)).size,
      quiz.content.questions.length
    );
  }
});

test("projects and reflections explain Scratch submission and help", () => {
  for (const module of validateTemplateDefinition(template).modules) {
    for (const activity of [module.activities[4], module.activities[7]]) {
      assert.deepEqual(activity.content.submission_accept, [".sb3"]);
      assert.ok(activity.content.submission_help.length >= 2);
      assert.match(activity.content.submission_instructions, /\.sb3/i);
      assert.match(activity.content.submission_instructions, /download|save/i);
    }
  }
});

test("Module 1 teaches course use, saving, privacy, hints, and testing", () => {
  const moduleOneText = template.modules[0].activities[0].content.body.toLowerCase();

  assert.match(moduleOneText, /open each lesson/);
  assert.match(moduleOneText, /complete the five quiz questions/);
  assert.match(moduleOneText, /\.sb3/);
  assert.match(moduleOneText, /private information/);
  assert.match(moduleOneText, /hint/);
  assert.match(moduleOneText, /test/);
});

test("Scratch profile rejects a broken module rhythm", () => {
  const broken = {
    ...template,
    modules: template.modules.map((module, index) =>
      index === 0
        ? { ...module, activities: module.activities.slice(0, 7) }
        : module
    ),
  };

  assert.throws(
    () => validateTemplateDefinition(broken),
    /eight activities/
  );
});

test("Scratch profile rejects duplicate quiz IDs and missing correct options", () => {
  const duplicateIds = structuredClone(template);
  duplicateIds.modules[0].activities[6].content.questions[1].id =
    duplicateIds.modules[0].activities[6].content.questions[0].id;
  assert.throws(() => validateTemplateDefinition(duplicateIds), /unique question IDs/);

  const missingAnswer = structuredClone(template);
  missingAnswer.modules[0].activities[6].content.questions[0].correct_answer =
    "not one of the options";
  assert.throws(() => validateTemplateDefinition(missingAnswer), /correct answer in its options/);
});
