function buildTemplateLearningOverview(builder) {
  if (!builder?.template) return null;

  const modules = (builder.modules || [])
    .filter((module) => module.is_published !== false)
    .map((module) => {
      let previousRequiredComplete = true;
      const activities = (module.activities || [])
        .filter((activity) => activity.is_published !== false)
        .map((activity) => {
          const optional = activity.availability_mode === "try_more";
          const isUnlocked = optional || previousRequiredComplete;
          if (!optional) previousRequiredComplete = false;
          return {
            ...activity,
            status: "not_started",
            score: null,
            completed_at: null,
            progress_updated_at: null,
            is_unlocked: isUnlocked,
            lock_reason: isUnlocked
              ? null
              : "Complete the previous required activity first.",
          };
        });
      const requiredActivities = activities.filter(
        (activity) => activity.availability_mode !== "try_more",
      );

      return {
        ...module,
        activities,
        is_unlocked: true,
        lock_reason: null,
        opens_at: null,
        total_activities: requiredActivities.length,
        completed_activities: 0,
        progress_percent: 0,
        score_percent: 0,
        is_done: false,
        try_more_total: activities.length - requiredActivities.length,
        try_more_completed: 0,
      };
    });

  const totalActivities = modules.reduce(
    (sum, module) => sum + module.total_activities,
    0,
  );

  return {
    course: builder.template,
    learner: null,
    modules,
    summary: {
      total_modules: modules.length,
      completed_modules: 0,
      total_activities: totalActivities,
      completed_activities: 0,
      progress_percent: 0,
      score_percent: 0,
      is_done: false,
    },
  };
}

function buildTemplateModuleLearning(builder, moduleId) {
  const overview = buildTemplateLearningOverview(builder);
  if (!overview) return null;

  const moduleIndex = overview.modules.findIndex(
    (module) => Number(module.id) === Number(moduleId),
  );
  if (moduleIndex === -1) return null;

  const module = overview.modules[moduleIndex];
  const previousModule = overview.modules[moduleIndex - 1] || null;
  const nextModule = overview.modules[moduleIndex + 1] || null;

  return {
    course: overview.course,
    learner: null,
    module,
    previous_module: previousModule
      ? { id: previousModule.id, title: previousModule.title, is_done: false }
      : null,
    next_module: nextModule
      ? {
          id: nextModule.id,
          title: nextModule.title,
          is_done: false,
          is_open: true,
        }
      : null,
    course_summary: overview.summary,
    is_unlocked: true,
    badge: null,
    feedback: null,
  };
}

module.exports = {
  buildTemplateLearningOverview,
  buildTemplateModuleLearning,
};
