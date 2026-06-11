const ACTIVITY_TYPES = new Set([
  "lesson", "quiz", "assignment", "discussion", "coding",
  "typing", "project", "reflection",
]);

function normalizeTemplateDefinition(definition = {}) {
  return {
    course_category: "general",
    certificate_enabled: true,
    is_active: true,
    ...definition,
    modules: (definition.modules || []).map((module, moduleIndex) => ({
      ...module,
      position: Number(module.position || moduleIndex + 1),
      is_published: module.is_published !== false,
      activities: (module.activities || []).map((activity, activityIndex) => ({
        points: 0,
        is_required: true,
        completion_rule: "manual",
        ...activity,
        position: Number(activity.position || activityIndex + 1),
        is_published: activity.is_published !== false,
      })),
    })),
  };
}

function assertUniquePositions(items, label) {
  const positions = new Set();
  for (const item of items) {
    if (positions.has(item.position)) {
      throw new Error(`Duplicate ${label} position ${item.position}.`);
    }
    positions.add(item.position);
  }
}

function validateTemplateDefinition(input) {
  const definition = normalizeTemplateDefinition(input);
  if (!definition.name?.trim()) throw new Error("Template name is required.");
  if (!definition.code?.trim()) throw new Error("Template code is required.");
  if (definition.estimated_weeks !== 8) throw new Error("Template must contain eight estimated weeks.");
  if (definition.settings?.mastery_score !== 80) throw new Error("Default mastery score must be 80.");
  if (definition.modules.length !== 8) throw new Error("Template must contain eight modules.");
  assertUniquePositions(definition.modules, "module");
  const requiredPurposes = ["welcome", "reading", "video", "discussion", "guided_practice", "build", "quiz", "level_up", "reflection", "celebration"];

  for (const module of definition.modules) {
    if (!module.title?.trim()) throw new Error("Every module needs a title.");
    if (!module.badge?.name?.trim()) throw new Error(`${module.title} needs a badge name.`);
    if (module.activities.length !== 10) throw new Error(`${module.title} must contain ten activities.`);
    assertUniquePositions(module.activities, `${module.title} activity`);
    const purposes = module.activities.map((activity) => activity.content?.purpose);
    if (JSON.stringify(purposes) !== JSON.stringify(requiredPurposes)) {
      throw new Error(`${module.title} activities must follow the required purpose order.`);
    }
    for (const activity of module.activities) {
      if (!ACTIVITY_TYPES.has(activity.activity_type)) {
        throw new Error(`Unsupported activity type ${activity.activity_type}.`);
      }
      if (activity.activity_type === "quiz" && !activity.content?.questions?.length) {
        throw new Error(`${activity.title} quiz must contain at least one question.`);
      }
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
      if (activity.content?.purpose === "video") {
        const media = activity.content.media || {};
        if (!media.video_title || !media.transcript) throw new Error(`${activity.title} needs a video title and transcript.`);
      }
    }
  }
  return definition;
}

module.exports = { ACTIVITY_TYPES, normalizeTemplateDefinition, validateTemplateDefinition };
