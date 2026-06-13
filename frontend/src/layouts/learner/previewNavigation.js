export function courseOverviewPath(courseId, previewMode = false, templatePreviewMode = false) {
  if (templatePreviewMode) return `/system-admin/courses/${courseId}/preview`;
  return previewMode ? `/school-admin/courses/${courseId}/preview` : `/learner/courses/${courseId}`;
}

export function moduleLearningPath(
  courseId,
  moduleId,
  activityId = null,
  previewMode = false,
  templatePreviewMode = false
) {
  const base = templatePreviewMode
    ? `/system-admin/courses/${courseId}/preview/modules/${moduleId}/learn`
    : previewMode
    ? `/school-admin/courses/${courseId}/preview/modules/${moduleId}/learn`
    : `/learner/courses/${courseId}/modules/${moduleId}/learn`;
  return activityId ? `${base}?activity=${activityId}` : base;
}
