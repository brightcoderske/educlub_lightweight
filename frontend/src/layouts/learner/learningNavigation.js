const COMPLETED_STATUSES = new Set(["completed", "graded"]);

export function activityLearningPath(courseId, moduleId, activityId = null) {
  const base = `/learner/courses/${courseId}/modules/${moduleId}/learn`;
  return activityId ? `${base}?activity=${activityId}` : base;
}

export function findActivityNavigation(activities = [], activeActivityId) {
  const index = activities.findIndex(
    (activity) => Number(activity.id) === Number(activeActivityId)
  );
  if (index < 0) return { previous: null, next: null };

  const previous = activities[index - 1];
  const next = activities[index + 1];
  return {
    previous: previous?.is_unlocked ? previous : null,
    next: next?.is_unlocked ? next : null,
  };
}

export function resolveInitialActivity(activities = [], requestedActivityId = null) {
  const requested = activities.find(
    (activity) => Number(activity.id) === Number(requestedActivityId) && activity.is_unlocked
  );
  if (requested) return requested.id;

  const recentlyTouched = activities
    .filter(
      (activity) =>
        activity.is_unlocked &&
        !COMPLETED_STATUSES.has(activity.status) &&
        activity.progress_updated_at
    )
    .sort(
      (left, right) =>
        new Date(right.progress_updated_at).getTime() - new Date(left.progress_updated_at).getTime()
    )[0];
  if (recentlyTouched) return recentlyTouched.id;

  return (
    activities.find((activity) => activity.is_unlocked && !COMPLETED_STATUSES.has(activity.status))
      ?.id ||
    activities.find((activity) => activity.is_unlocked)?.id ||
    null
  );
}

export function findContinueLearning(courseOverviews = []) {
  const candidates = courseOverviews.flatMap(({ allocation, overview }) =>
    (overview?.modules || []).flatMap((courseModule) =>
      (courseModule.activities || [])
        .filter(
          (activity) =>
            activity.is_unlocked &&
            !activity.requires_payment &&
            !COMPLETED_STATUSES.has(activity.status)
        )
        .map((activity) => ({
          courseId: allocation.course_id,
          courseName: allocation.course_name || overview?.course?.name || "Course",
          moduleId: courseModule.id,
          moduleTitle: courseModule.title,
          modulePosition: Number(courseModule.position || 0),
          activityId: activity.id,
          activityTitle: activity.title,
          activityPosition: Number(activity.position || 0),
          progressUpdatedAt: activity.progress_updated_at || null,
        }))
    )
  );

  const recentlyTouched = candidates
    .filter((candidate) => candidate.progressUpdatedAt)
    .sort(
      (left, right) =>
        new Date(right.progressUpdatedAt).getTime() - new Date(left.progressUpdatedAt).getTime()
    )[0];
  if (recentlyTouched) return recentlyTouched;

  return (
    candidates.sort(
      (left, right) =>
        left.modulePosition - right.modulePosition || left.activityPosition - right.activityPosition
    )[0] || null
  );
}
