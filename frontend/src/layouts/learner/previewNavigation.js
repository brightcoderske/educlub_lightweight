export function courseOverviewPath(courseId, previewMode = false) {
  return previewMode ? `/school-admin/courses/${courseId}/preview` : `/learner/courses/${courseId}`;
}

export function moduleLearningPath(courseId, moduleId, activityId = null, previewMode = false) {
  const base = previewMode
    ? `/school-admin/courses/${courseId}/preview/modules/${moduleId}/learn`
    : `/learner/courses/${courseId}/modules/${moduleId}/learn`;
  return activityId ? `${base}?activity=${activityId}` : base;
}
