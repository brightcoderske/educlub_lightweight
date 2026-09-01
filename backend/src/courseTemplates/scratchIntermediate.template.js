const modules = require("./scratchIntermediate.modules");

const asset = (name) => `/course-assets/scratch-intermediate/${name}.webp`;
const HERO_ASSETS = [
  "module-01-story",
  "module-02-maze",
  "module-03-catch",
  "module-04-clones",
  "module-05-quiz",
  "module-06-animation",
  "module-07-pet",
  "module-08-drawing",
  "module-09-ecosystem",
  "module-10-capstone",
];

function section(title, items = []) {
  return `${title}:\n${items.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function activity(title, activityType, purpose, content, options = {}) {
  return {
    title,
    activity_type: activityType,
    content: { purpose, ...content },
    points: options.points || 0,
    is_required: options.is_required !== false,
    completion_rule: options.completion_rule || "viewed",
    pass_score: options.pass_score || null,
  };
}

function quizQuestions(module, moduleNumber) {
  return module.questions.map(([prompt, options, correctAnswer], index) => ({
    id: `scratch-m${moduleNumber}-q${index + 1}`,
    question_type: "multiple_choice",
    prompt,
    options,
    correct_answer: correctAnswer,
    points: 1,
    hint: `Review the ${index < 2 ? "key concepts" : "algorithm and guided notes"} before choosing.`,
    explanation: `${correctAnswer} is correct because it matches the rule used in this module.`,
  }));
}

function submissionContent(module) {
  return {
    submission_accept: [".sb3"],
    submission_help: [
      "In Scratch, choose File > Save to your computer to download your project.",
      "Check that the file name ends in .sb3, then use the upload area. Ask a teacher for help if it does not attach.",
    ],
    submission_instructions: `Test ${module.outcome}, then download or save the Scratch project as a .sb3 file and upload it here. Use a safe project name without private information.`,
  };
}

function teacherNotes(module, _moduleNumber) {
  return `Essential concept: learners use ${module.focus} to create ${module.outcome}. Before the session, open Scratch, check saving and .sb3 download access, and prepare a tiny demonstration rather than a finished answer. Ask learners to predict each algorithm step before coding. Common misconception: ${module.misconception} Support learners by reading one step at a time, pairing vocabulary with visible blocks, and testing one script in isolation. Extend confident learners with the optional challenge. Expected evidence includes ${module.projectChecks.join(", ")}. Project feedback rubric: Growing: the core idea is partly working and the learner needs help to explain or test it. Ready: the required behavior works, the learner used the algorithm, and the success checks have evidence. Excellent: the project is reliable, clearly explained, tested by another user, and thoughtfully improved. Give feedback on planning, working behavior, testing, clarity, and explanation. Remind learners to use safe names, keep private information out of projects, and seek teacher approval before sharing anything publicly.`;
}

function activitiesFor(module, index) {
  const moduleNumber = index + 1;
  const number = String(moduleNumber).padStart(2, "0");
  const heroAsset = HERO_ASSETS[index];
  const introduction = module.intro || `In this module you will explore ${module.focus} and build ${module.outcome}. Predict first, build in small steps, and test after every useful change.`;
  const vocabulary = module.concepts.map(([term, meaning]) => ({ term, meaning }));
  const conceptNotes = module.concepts.map(([term, meaning]) => `${term}: ${meaning}. Find or build a small example, predict what will happen, then test your prediction.`);
  const submission = submissionContent(module);
  const overviewNotes = [
    `Mission: create ${module.outcome}.`,
    `Core ideas: ${module.focus}.`,
    "Work safely: use a project nickname and do not include private information.",
    "Learning habit: plan, predict, test one part, fix one clue, and test again.",
  ];
  const practiceSteps = [
    "Create or choose only the sprites and backdrop needed for this small practice.",
    "Build the starting event and one behavior from the algorithm.",
    "Predict the result, run it, and describe what actually happened.",
    "Change one block at a time until the practice works reliably.",
  ];
  const practiceChecks = [
    "the script starts correctly",
    "the core behavior is visible",
    "the learner tested an edge case",
  ];
  const buildSteps = [
    "Create the smallest version that demonstrates the main rule.",
    "Add one feature at a time and test after each addition.",
    "Ask another learner to try the controls without coaching.",
    "Fix the most important problem, then complete the success checklist.",
  ];
  const reflectionPrompts = [
    "Name one block or idea you can now explain.",
    "Describe one bug, the clue you noticed, and the change that fixed it.",
    "Choose one success check you are proud of and give evidence.",
    "Write one specific improvement you would make with more time.",
  ];

  return [
    activity("Module Overview and Learning Goals", "lesson", "overview", {
      body: [
        introduction,
        section("Learning objectives", module.learningObjectives),
        section("Guided notes", overviewNotes),
      ].join("\n\n"),
      concepts: vocabulary,
      guided_notes: overviewNotes,
      learning_objectives: module.learningObjectives,
    }),
    activity("Visual Learning and Guided Notes", "lesson", "visual_learning", {
      body: [
        `Study the illustrated project scene, then connect each idea to a Scratch block or project behavior. ${module.misconception}`,
        section("Key concepts", conceptNotes),
        "Predict before running: point to the event, repeated action, decision, or changing value and predict the result.",
      ].join("\n\n"),
      vocabulary,
      guided_notes: conceptNotes,
      predict_prompt: "Before running the example, point to the event, repeated action, decision, or changing value and predict the result.",
      debugging_callout: `Common mix-up: ${module.misconception}`,
      media: {
        image_url: asset(heroAsset),
        image_alt: `Child-friendly illustrated project scene for ${module.title}.`,
      },
    }),
    activity("Plan the Algorithm", "coding", "algorithm", {
      description: `Plan ${module.outcome} before opening Scratch. Say each step in plain language, then connect it to blocks.`,
      body: section("Algorithm steps", module.algorithm),
      algorithm_steps: module.algorithm,
      pseudocode: module.algorithm.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n"),
      friendly_hints: [
        "Circle every step that asks a yes-or-no question.",
        "Underline information that changes while the project runs.",
        "Test the shortest useful path through the algorithm first.",
      ],
      media: {
        image_url: asset(`module-${number}-algorithm`),
        image_alt: `Flowchart showing the algorithm for ${module.title}.`,
      },
    }, { completion_rule: "submitted" }),
    activity("Guided Scratch Practice", "coding", "guided_practice", {
      description: module.practice,
      body: [
        section("Practice steps", practiceSteps),
        section("Success checks", practiceChecks),
      ].join("\n\n"),
      steps: practiceSteps,
      friendly_hints: [
        "Use the block color categories to narrow your search.",
        "Click a block or short stack to test it by itself.",
        "Show changing variables and add temporary say blocks while debugging.",
      ],
      success_checks: practiceChecks,
    }, { points: 5, completion_rule: "submitted" }),
    activity("Main Project", "project", "main_project", {
      project_brief: module.project,
      body: [
        section("Build steps", buildSteps),
        section("Success checks", module.projectChecks),
      ].join("\n\n"),
      success_checks: module.projectChecks,
      build_steps: buildSteps,
      friendly_hints: ["Return to the algorithm when you feel stuck.", "Use temporary visible variables or speech to inspect what the program knows."],
      ...submission,
    }, { points: 20, completion_rule: "submitted" }),
    activity("Optional Challenge", "assignment", "challenge", {
      project_brief: module.challenge,
      body: section("Success checks", [
        "required project still works",
        "extension has a clear purpose",
        "new behavior has been tested",
      ]),
      submission_instructions: "Try this extension after the required main project works. Explain which rule you changed and how you tested it.",
      success_checks: ["required project still works", "extension has a clear purpose", "new behavior has been tested"],
    }, { is_required: false, points: 5, completion_rule: "submitted" }),
    activity("Knowledge Check", "quiz", "quiz", {
      description: "Answer five questions. Use the hints, read explanations, and retry until you reach mastery.",
      questions: quizQuestions(module, moduleNumber),
      unlimited_retries: true,
    }, { points: 10, completion_rule: "score_at_least", pass_score: 80 }),
    activity("Reflect and Submit", "reflection", "reflection", {
      reflection_prompt: "What did you learn, what was difficult, and what will you improve next time?",
      body: [
        section("Reflection prompts", reflectionPrompts),
        "Confidence check: choose one statement: I need another example; I can do this with hints; I can do this independently; or I can help someone else.",
      ].join("\n\n"),
      prompts: reflectionPrompts,
      confidence_prompt: "Choose: I need another example, I can do this with hints, I can do this independently, or I can help someone else.",
      ...submission,
    }, { completion_rule: "submitted" }),
  ];
}

const preparedModules = modules.map((module, index) => ({
  ...module,
  learningObjectives: [
    `Create ${module.outcome}.`,
    `Explain how ${module.concepts[0][0]} and ${module.concepts[1][0]} affect the project.`,
    `Plan and follow an algorithm containing at least ${module.algorithm.length} ordered steps.`,
    `Test the project against at least ${Math.min(4, module.projectChecks.length)} success checks and repair one problem.`,
    "Submit a working .sb3 file and describe one evidence-based improvement.",
  ],
  teacherNotes: teacherNotes(module, index + 1),
}));

module.exports = {
  name: "Scratch Intermediate: Creating Games, Animations and Interactive Projects",
  code: "SCRATCH-INTERMEDIATE",
  validation_profile: "scratch_intermediate",
  description: "Plan, create, test, and explain ten original Scratch games, animations, stories, quizzes, and simulations.",
  target_level: "Intermediate, ages 8-14",
  image_url: asset("course-cover"),
  image_alt: "Young creators planning colorful games, animations, and interactive Scratch projects.",
  estimated_weeks: 10,
  learning_objectives: [
    "Plan programs with algorithms, flowcharts, and pseudocode.",
    "Use events, loops, conditions, variables, lists, messages, clones, and custom blocks.",
    "Break projects into smaller parts and debug one part at a time.",
    "Test with users, improve from evidence, and submit a portfolio of .sb3 projects.",
  ],
  certificate_enabled: true,
  course_category: "general",
  settings: {
    mastery_score: 80,
    unlimited_quiz_retries: true,
    roadmap_image_url: asset("course-roadmap"),
    roadmap_image_alt: "Roadmap of ten Scratch projects from interactive story to portfolio capstone.",
    public_showcase_enabled: false,
    teacher_publish_approval_required: true,
  },
  modules: preparedModules.map((module, index) => ({
    title: module.title,
    description: `Learn ${module.focus}, then create ${module.outcome}.`,
    learning_objectives: module.learningObjectives,
    learning_outcomes: module.learningObjectives,
    teacher_notes: module.teacherNotes,
    activities: activitiesFor(module, index),
  })),
};
