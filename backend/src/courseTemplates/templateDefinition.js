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

const PROFILE_VALIDATORS = {
  generic: () => {},
  web_development_1: validateWebDevelopment1,
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
};
