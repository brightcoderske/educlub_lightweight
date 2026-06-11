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

  for (const module of definition.modules) {
    if (!module.title?.trim()) throw new Error("Every module needs a title.");
    if (!module.badge?.name?.trim()) throw new Error(`${module.title} needs a badge name.`);
    assertUniquePositions(module.activities, `${module.title} activity`);
    for (const activity of module.activities) {
      if (!ACTIVITY_TYPES.has(activity.activity_type)) {
        throw new Error(`Unsupported activity type ${activity.activity_type}.`);
      }
      if (activity.activity_type === "quiz" && !activity.content?.questions?.length) {
        throw new Error(`${activity.title} quiz must contain at least one question.`);
      }
    }
  }
  return definition;
}

module.exports = { ACTIVITY_TYPES, normalizeTemplateDefinition, validateTemplateDefinition };
