const ACTIVITY_TYPES = new Set([
  "lesson", "quiz", "assignment", "discussion", "coding",
  "typing", "project", "reflection",
]);

function normalizeTemplateDefinition(definition = {}) {
  if (definition.modules !== undefined && !Array.isArray(definition.modules)) {
    throw new Error("Template modules must be an array.");
  }
  return {
    course_category: "general",
    certificate_enabled: true,
    is_active: true,
    ...definition,
    modules: (definition.modules || []).map((module, moduleIndex) => ({
      ...module,
      position: Number(module.position ?? moduleIndex + 1),
      is_published: module.is_published !== false,
      activities: (() => {
        if (module.activities !== undefined && !Array.isArray(module.activities)) {
          throw new Error(`${module.title || "Module"} activities must be an array.`);
        }
        return (module.activities || []).map((activity, activityIndex) => ({
          points: 0,
          is_required: true,
          completion_rule: "manual",
          ...activity,
          position: Number(activity.position ?? activityIndex + 1),
          is_published: activity.is_published !== false,
        }));
      })(),
    })),
  };
}

function assertUniquePositions(items, label) {
  const positions = new Set();
  for (const [index, item] of items.entries()) {
    if (!Number.isInteger(item.position) || item.position !== index + 1) {
      throw new Error(`${label} positions must be contiguous positive integers.`);
    }
    if (positions.has(item.position)) {
      throw new Error(`Duplicate ${label} position ${item.position}.`);
    }
    positions.add(item.position);
  }
}

function validateSharedDefinition(definition) {
  if (!definition.name?.trim()) throw new Error("Template name is required.");
  if (!definition.code?.trim()) throw new Error("Template code is required.");
  if (
    !Number.isInteger(Number(definition.estimated_weeks)) ||
    Number(definition.estimated_weeks) < 1
  ) {
    throw new Error("Template estimated weeks must be a positive number.");
  }
  if (!definition.modules.length) {
    throw new Error("Template must contain at least one module.");
  }

  assertUniquePositions(definition.modules, "module");
  for (const module of definition.modules) {
    if (!module.title?.trim()) throw new Error("Every module needs a title.");
    if (!module.activities.length) {
      throw new Error(`${module.title} must contain at least one activity.`);
    }
    assertUniquePositions(module.activities, `${module.title} activity`);
    for (const activity of module.activities) {
      if (!activity.title?.trim()) throw new Error("Every activity needs a title.");
      if (!ACTIVITY_TYPES.has(activity.activity_type)) {
        throw new Error(`Unsupported activity type ${activity.activity_type}.`);
      }
      if (activity.activity_type === "quiz") {
        const questions = activity.content?.questions || [];
        if (!questions.length) {
          throw new Error(`${activity.title} quiz must contain at least one question.`);
        }
        if (!questions.every((question) =>
          question.id && question.prompt && question.question_type &&
          Array.isArray(question.options) && question.correct_answer !== undefined &&
          Number.isFinite(Number(question.points))
        )) {
          throw new Error(`${activity.title} questions are incomplete.`);
        }
      }
      const media = activity.content?.media || {};
      if (media.image_url && !media.image_alt?.trim()) {
        throw new Error(`${activity.title} needs image alternative text.`);
      }
    }
  }
}

function validateWebDevelopment1(definition) {
  if (definition.estimated_weeks !== 8) {
    throw new Error("Template must contain eight estimated weeks.");
  }
  if (definition.settings?.mastery_score !== 80) {
    throw new Error("Default mastery score must be 80.");
  }
  if (definition.modules.length !== 8) {
    throw new Error("Template must contain eight modules.");
  }
  const requiredPurposes = ["welcome", "reading", "video", "discussion", "guided_practice", "build", "quiz", "level_up", "reflection", "celebration"];

  for (const module of definition.modules) {
    if (!module.badge?.name?.trim()) throw new Error(`${module.title} needs a badge name.`);
    if (module.activities.length !== 10) throw new Error(`${module.title} must contain ten activities.`);
    const purposes = module.activities.map((activity) => activity.content?.purpose);
    if (JSON.stringify(purposes) !== JSON.stringify(requiredPurposes)) {
      throw new Error(`${module.title} activities must follow the required purpose order.`);
    }
    for (const activity of module.activities) {
      if (activity.activity_type === "quiz") {
        const questions = activity.content.questions;
        const types = new Set(questions.map((question) => question.question_type));
        for (const type of ["multiple_choice", "matching", "short_answer", "ordering"]) {
          if (!types.has(type)) throw new Error(`${activity.title} is missing ${type}.`);
        }
        if (!questions.every((question) => question.hint && question.explanation)) {
          throw new Error(`${activity.title} questions need hints and explanations.`);
        }
        if (Number(activity.pass_score) !== 80) throw new Error(`${activity.title} pass score must be 80.`);
      }
      if (activity.content?.purpose === "reading") {
        if (!activity.content.body?.trim()) throw new Error(`${activity.title} needs reading content.`);
        if (!activity.content.media?.image_alt?.trim()) throw new Error(`${activity.title} needs image alternative text.`);
      }
      if (activity.content?.purpose === "video") {
        const media = activity.content.media || {};
        if (!media.video_title || !media.transcript || !media.image_alt) throw new Error(`${activity.title} needs complete media fallbacks.`);
      }
    }
  }
}

function validateScratchIntermediate(definition) {
  const requiredPurposes = [
    "overview", "visual_learning", "algorithm", "guided_practice",
    "main_project", "challenge", "quiz", "reflection",
  ];
  const requiredTypes = [
    "lesson", "lesson", "coding", "coding",
    "project", "assignment", "quiz", "reflection",
  ];

  if (definition.estimated_weeks !== 10) {
    throw new Error("Scratch Intermediate must contain ten estimated weeks.");
  }
  if (definition.settings?.mastery_score !== 80) {
    throw new Error("Scratch Intermediate mastery score must be 80.");
  }
  if (definition.modules.length !== 10) {
    throw new Error("Scratch Intermediate must contain ten modules.");
  }

  for (const module of definition.modules) {
    if (!Array.isArray(module.learning_objectives) || module.learning_objectives.length < 4) {
      throw new Error(`${module.title} needs at least four learning objectives.`);
    }
    if (!module.teacher_notes?.trim()) {
      throw new Error(`${module.title} needs teacher notes.`);
    }
    if (module.activities.length !== 8) {
      throw new Error(`${module.title} must contain eight activities.`);
    }
    if (JSON.stringify(module.activities.map((item) => item.content?.purpose)) !== JSON.stringify(requiredPurposes)) {
      throw new Error(`${module.title} activities must follow the Scratch purpose order.`);
    }
    if (JSON.stringify(module.activities.map((item) => item.activity_type)) !== JSON.stringify(requiredTypes)) {
      throw new Error(`${module.title} activities must use the required Scratch activity types.`);
    }

    const [overview, visual, algorithm, practice, project, challenge, quiz, reflection] = module.activities;
    for (const item of [visual, algorithm]) {
      const media = item.content?.media || {};
      if (!media.image_url?.startsWith("/course-assets/scratch-intermediate/") || !media.image_alt?.trim()) {
        throw new Error(`${item.title} needs an accessible Scratch Intermediate visual.`);
      }
    }
    if (!Array.isArray(algorithm.content?.algorithm_steps) || algorithm.content.algorithm_steps.length < 5) {
      throw new Error(`${algorithm.title} needs at least five algorithm steps.`);
    }
    if (!practice.content?.description?.trim()) {
      throw new Error(`${practice.title} needs guided practice instructions.`);
    }
    if (!project.is_required || !Array.isArray(project.content?.success_checks) || project.content.success_checks.length < 4) {
      throw new Error(`${project.title} must be a required project with success checks.`);
    }
    if (challenge.is_required) {
      throw new Error(`${challenge.title} must be optional.`);
    }
    const quizQuestions = quiz.content?.questions || [];
    const questionIds = quizQuestions.map((question) => question.id);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new Error(`${quiz.title} must use unique question IDs.`);
    }
    if (!quizQuestions.every((question) =>
      question.options.filter((option) => option === question.correct_answer).length === 1
    )) {
      throw new Error(`${quiz.title} questions must include the correct answer in its options.`);
    }
    if (
      Number(quiz.pass_score) !== 80 ||
      quizQuestions.length !== 5 ||
      !quizQuestions.every((question) =>
        question.question_type === "multiple_choice" &&
        question.options.length === 4 &&
        question.hint?.trim() &&
        question.explanation?.trim()
      )
    ) {
      throw new Error(`${quiz.title} needs five supported multiple-choice questions and an 80 pass score.`);
    }
    for (const item of [project, reflection]) {
      if (
        !Array.isArray(item.content?.submission_accept) ||
        !item.content.submission_accept.includes(".sb3") ||
        !item.content.submission_instructions?.includes(".sb3") ||
        !Array.isArray(item.content.submission_help) ||
        !item.content.submission_help.length
      ) {
        throw new Error(`${item.title} needs .sb3 submission instructions and help.`);
      }
    }
  }
}

const PROFILE_VALIDATORS = {
  generic: () => {},
  web_development_1: validateWebDevelopment1,
  scratch_intermediate: validateScratchIntermediate,
};

function validateTemplateDefinition(input) {
  const definition = normalizeTemplateDefinition(input);
  validateSharedDefinition(definition);
  const profile = definition.validation_profile || "generic";
  const validateProfile = PROFILE_VALIDATORS[profile];
  if (!validateProfile) {
    throw new Error(`Unknown template validation profile ${profile}.`);
  }
  validateProfile(definition);
  return definition;
}

module.exports = {
  ACTIVITY_TYPES,
  normalizeTemplateDefinition,
  validateTemplateDefinition,
  validateSharedDefinition,
  validateWebDevelopment1,
  validateScratchIntermediate,
};
