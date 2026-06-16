const SESSION_PLAN = [
  { minutes: 10, phase: "Imagine and discuss", action: "Meet the challenge, share predictions, and agree how learners will work safely." },
  { minutes: 15, phase: "Learn and plan", action: "Study the key ideas, vocabulary, visual guide, and algorithm before opening Scratch." },
  { minutes: 45, phase: "Build and create", action: "Complete the guided build, then develop one main project choice in small tested steps." },
  { minutes: 10, phase: "Test and improve", action: "Use the success checks, collect peer feedback, and repair the most important problem." },
  { minutes: 10, phase: "Explain and reflect", action: "Complete the quiz, save the .sb3 file, submit evidence, and identify the next improvement." },
];

const SUBMISSION = {
  submission_accept: [".sb3"],
  submission_help: [
    "In Scratch, choose File > Save to your computer and check that the downloaded file ends in .sb3.",
    "Use a project nickname, remove private information, test the saved file, then upload it in Educlub.",
  ],
  submission_instructions: "Save or download the finished Scratch project as a .sb3 file, reopen it to confirm it works, and upload it with a short explanation of one tested improvement.",
};

function numbered(title, items) {
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

function objectivesFor(module) {
  return [
    `Explain how ${module.concepts[0][0]} and ${module.concepts[1][0]} help solve this module's challenge.`,
    `Plan ${module.outcome} with an ordered algorithm of at least ${module.algorithm.length} steps.`,
    `Build and test ${module.practice.title.toLowerCase()} before starting an independent project choice.`,
    `Create one main project that demonstrates at least four stated success checks.`,
    "Submit a working .sb3 file and explain one bug, test result, and evidence-based improvement.",
  ];
}

function guidedNotesFor(module, course) {
  const notes = module.concepts.map(([term, meaning]) =>
    `${term}: ${meaning}. Find the related Scratch block or behavior, predict its result, and test it in a tiny script.`,
  );
  notes.push(
    `This module connects coding to ${module.steam}. The computer follows rules; it does not understand the topic as a person does.`,
    `Work at the ${course.paths.join(", ")} path that gives useful challenge. A learner may change path during the module.`,
    `Debugging focus: ${module.debugging}. Change one thing, run the same test again, and record whether the evidence improved.`,
    "Use safe project names and fictional or anonymous information. Public sharing requires teacher approval.",
  );
  return notes;
}

function projectChoice(choice, module) {
  return {
    title: choice.title,
    brief: choice.brief,
    build_steps: [
      `Write one sentence describing the user, purpose, and successful result for ${choice.title}.`,
      `Create only the sprites, backdrops, variables, lists, or extensions required for the first working version.`,
      `Build the starting event and the first three algorithm actions: ${module.algorithm.slice(0, 3).join(" ")}`,
      `Add the remaining behavior one feature at a time: ${choice.features.join("; ")}.`,
      "Test the normal path, one unusual input or edge case, and the restart or ending behavior.",
      "Ask another learner to use the project without coaching, then improve the clearest problem they discover.",
    ],
    success_checks: choice.features.map((feature) => `The project clearly demonstrates: ${feature}.`),
  };
}

function quizQuestions(module, courseCode, moduleNumber) {
  return module.quiz.map((question, index) => ({
    id: `${courseCode.toLowerCase()}-m${moduleNumber}-q${index + 1}`,
    question_type: "multiple_choice",
    prompt: question.prompt,
    options: question.options,
    correct_answer: question.answer,
    points: 1,
    hint: question.hint || `Review the module notes about ${module.concepts[Math.min(index, 3)][0]} and eliminate choices that do a different job.`,
    explanation: question.explanation || `${question.answer} is correct because ${question.reason}`,
  }));
}

function teacherNotes(module, course) {
  const aiNote = module.ai
    ? ` AI and data safety: ${module.ai.safety} Require the Scratch-only route when the approved external tool, account, connectivity, or consent is unavailable.`
    : "";
  return [
    `Essential learning: learners use ${module.focus} to create ${module.outcome}.`,
    `Preparation: open Scratch, check .sb3 saving, prepare the named guided build, and gather any optional ${module.materials || "paper and pencils"}. Demonstrate only the minimum skill so learners still make design decisions.`,
    `Discussion: use the supplied prompt before coding. Ask learners to justify predictions, listen for the misconception "${module.misconception}", and use the sentence starters to include quieter learners.`,
    `Support: the ${course.paths[0]} path uses the guided steps, starter assets, fewer sprites, and one rule at a time. The ${course.paths[1]} path completes the standard success criteria. The ${course.paths[2]} path adds deeper logic, data, accessibility, or evaluation without skipping testing.`,
    `Common debugging focus: ${module.debugging} Ask the learner what the program knows now, which script should run next, and what visible evidence would prove the repair worked.`,
    `Assessment evidence: algorithm, discussion contribution, guided build, one completed project choice, success-check results, five-question quiz, reflection, and a working .sb3 submission.`,
    "Feedback rubric: Growing means the core behavior partly works and needs guided testing. Ready means the required behavior works, evidence covers the success checks, and the learner can explain important blocks. Excellent means the project is reliable, independently designed, tested by another user, accessible where practical, and improved from evidence.",
    `Safeguarding: use fictional or anonymous information, avoid public sharing without school approval, and keep discussion replies kind and relevant.${aiNote}`,
  ].join(" ");
}

function moduleActivities(module, course, moduleIndex) {
  const objectives = objectivesFor(module);
  const guidedNotes = guidedNotesFor(module, course);
  const richHtml = module.rich_html || {};
  const visualBody = [
    `Imagine the finished project: ${module.outcome}. The user should immediately understand what to do and see useful feedback after each important action.`,
    `Look for four connected parts: input or event, stored information, rule or decision, and visible output. In this module those parts use ${module.focus}.`,
    `STEAM connection: ${module.steam}. Scratch is being used as a design and investigation tool, not only as a way to copy blocks.`,
    `Predict before running: ${module.predict}`,
    `Common misconception: ${module.misconception}`,
  ].join("\n\n");
  const discussionQuestions = module.discussion.questions;
  const practiceSteps = [
    `Create a new project named with a safe nickname and the words "${module.practice.title}".`,
    ...module.practice.steps,
    `Run the same test twice and confirm that ${module.practice.checks[0].toLowerCase()}.`,
    "Save the guided build before beginning a main project choice.",
  ];
  const challengeSteps = [
    `Duplicate or save a new version of the working main project before adding ${module.challenge.title.toLowerCase()}.`,
    ...module.challenge.steps,
    "Compare the required version and extension, then explain whether the new feature improves the user experience or investigation.",
  ];
  const reflectionPrompts = [
    `Explain ${module.concepts[0][0]} in your own words and point to where it appears in the project.`,
    `Describe one bug or unexpected result connected to ${module.debugging.toLowerCase()}`,
    "Report one test: what input or action you tried, what you expected, what happened, and what you changed.",
    `Explain how the project connects to ${module.steam}.`,
    "Choose the next step: practise again, improve this project, attempt the optional challenge, or help another learner.",
  ];
  const courseCode = course.code.replace("SCRATCH-", "");

  return [
    activity("Launch, Objectives and Guided Notes", "lesson", "overview", {
      rich_html: richHtml.overview,
      body: [
        module.introduction,
        numbered("Learning objectives", objectives),
        numbered("Guided learning notes", guidedNotes),
      ].join("\n\n"),
      learning_objectives: objectives,
      vocabulary: module.concepts.map(([term, meaning]) => ({ term, meaning })),
      guided_notes: guidedNotes,
      session_plan: SESSION_PLAN,
      differentiation: {
        paths: course.paths,
        support: module.support,
        extension: module.challenge.brief,
      },
    }),
    activity("See the System and Predict", "lesson", "visual_learning", {
      rich_html: richHtml.visual_learning,
      body: visualBody,
      predict_prompt: module.predict,
      system_parts: ["input or event", "stored information", "rule or decision", "visible output"],
      misconception: module.misconception,
      steam_connection: module.steam,
    }),
    activity("Plan the Algorithm", "coding", "algorithm", {
      rich_html: richHtml.algorithm,
      description: `Plan ${module.outcome} before building it.`,
      body: numbered("Algorithm", module.algorithm),
      algorithm_steps: module.algorithm,
      planning_prompts: [
        "Circle events or inputs.",
        "Underline information that changes.",
        "Mark every decision with its Yes and No actions.",
        "Identify how the project restarts or ends.",
      ],
      debugging_hints: [
        "Test the shortest useful path through the algorithm first.",
        "Display changing values while debugging.",
        `Check this module's main risk: ${module.debugging}`,
      ],
    }, { completion_rule: "submitted" }),
    activity("Discuss, Reason and Respect", "discussion", "discussion", {
      rich_html: richHtml.discussion,
      discussion_prompt: module.discussion.prompt,
      questions: discussionQuestions,
      sentence_starters: [
        "I predict ___ because the rule says ___.",
        "I agree or disagree with ___ because my evidence is ___.",
        "A fair or safer design would ___.",
      ],
      description: [
        numbered("Discuss these questions", discussionQuestions),
        numbered("Sentence starters", [
          "I predict ___ because the rule says ___.",
          "I agree or disagree with ___ because my evidence is ___.",
          "A fair or safer design would ___.",
        ]),
        "Discussion safety: use fictional or anonymous examples, respond to ideas rather than people, and support claims with evidence.",
      ].join("\n\n"),
      moderation_notes: "Use fictional or anonymous examples. Respond to ideas rather than people, explain disagreement with evidence, and do not post names, contact details, passwords, faces, voices, or other private information.",
    }, { completion_rule: "submitted" }),
    activity(`Guided Build: ${module.practice.title}`, "coding", "guided_practice", {
      rich_html: richHtml.guided_practice,
      project_brief: module.practice.brief,
      body: [
        module.practice.brief,
        numbered("Build steps", practiceSteps),
        numbered("Success checks", module.practice.checks),
      ].join("\n\n"),
      steps: practiceSteps,
      success_checks: module.practice.checks,
      debugging_hints: [
        module.debugging,
        "Click a block or short stack to test it by itself.",
        "Use temporary say blocks or visible variables to inspect what the program knows.",
      ],
    }, { points: 5, completion_rule: "submitted" }),
    activity("Choose and Build a Main Project", "project", "main_project", {
      rich_html: richHtml.main_project,
      project_brief: `Choose one of the two complete projects. Both practise ${module.focus} and connect to ${module.steam}.`,
      project_choices: module.projects.map((choice) => projectChoice(choice, module)),
      body: module.projects.map((choice, choiceIndex) => {
        const prepared = projectChoice(choice, module);
        return [
          `PROJECT CHOICE ${choiceIndex + 1}: ${prepared.title}`,
          prepared.brief,
          numbered("Build steps", prepared.build_steps),
          numbered("Success checks", prepared.success_checks),
        ].join("\n");
      }).join("\n\n"),
      selection_prompt: "Choose the project whose purpose matters most to you. Write why it is a good match before building.",
      rubric: ["working behavior", "coding ideas", "design clarity", "testing evidence", "explanation"],
      ...SUBMISSION,
    }, { points: 20, completion_rule: "submitted" }),
    activity(`Try It Yourself: ${module.challenge.title}`, "assignment", "challenge", {
      rich_html: richHtml.challenge,
      project_brief: module.challenge.brief,
      body: [
        module.challenge.brief,
        numbered("Extension steps", challengeSteps),
        numbered("Success checks", module.challenge.checks),
      ].join("\n\n"),
      steps: challengeSteps,
      success_checks: module.challenge.checks,
      submission_instructions: "Submit the optional extension with a note explaining the new rule, evidence that the required project still works, and one limitation.",
    }, { points: 5, is_required: false, completion_rule: "submitted" }),
    activity("Knowledge Check", "quiz", "quiz", {
      rich_html: richHtml.quiz,
      description: "Answer all five questions. Use the specific hints, read every explanation, and retry until you reach 80 percent mastery.",
      questions: quizQuestions(module, courseCode, moduleIndex + 1),
      unlimited_retries: true,
    }, { points: 10, completion_rule: "score_at_least", pass_score: 80 }),
    activity("Reflect, Explain and Submit", "reflection", "reflection", {
      rich_html: richHtml.reflection,
      body: numbered("Reflection and evidence", reflectionPrompts),
      prompts: reflectionPrompts,
      confidence_prompt: "Choose one and explain: I need another example; I can do this with hints; I can do this independently; I can teach this idea.",
      ai_guidance: module.ai || null,
      ...SUBMISSION,
    }, { completion_rule: "submitted" }),
  ];
}

function buildScratchCourse(course) {
  return {
    name: course.name,
    code: course.code,
    validation_profile: "scratch_progressive",
    description: course.description,
    target_level: course.targetLevel,
    image_url: course.imageUrl,
    image_alt: course.imageAlt,
    estimated_weeks: 10,
    learning_objectives: course.learningObjectives,
    certificate_enabled: true,
    course_category: "general",
    settings: {
      mastery_score: 80,
      unlimited_quiz_retries: true,
      public_showcase_enabled: false,
      teacher_publish_approval_required: true,
      roadmap_image_url: course.roadmapUrl,
      roadmap_image_alt: course.roadmapAlt,
    },
    modules: course.modules.map((module, index) => ({
      title: module.title,
      description: `Learn ${module.focus}, then create ${module.outcome}.`,
      learning_objectives: objectivesFor(module),
      learning_outcomes: objectivesFor(module),
      teacher_notes: teacherNotes(module, course),
      ai_focus: Boolean(module.ai),
      activities: moduleActivities(module, course, index),
    })),
  };
}

module.exports = { buildScratchCourse };
