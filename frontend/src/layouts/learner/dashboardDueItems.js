import { activityLearningPath } from "./learningNavigation";

const COMPLETED_STATUSES = new Set(["completed", "graded"]);

function dateBoundary(value, endOfDay = false) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
}

function isCurrentWeek(item, now) {
  const start = dateBoundary(item.week_start_date);
  const end = dateBoundary(item.week_end_date, true);
  return Boolean(start && end && now >= start && now <= end);
}

export function findActiveWeekLearning(courseOverviews = [], now = new Date()) {
  const candidates = courseOverviews.flatMap(({ allocation, overview }) =>
    (overview?.modules || []).flatMap((courseModule) => {
      const opensAt = courseModule.opens_at ? new Date(courseModule.opens_at) : null;
      if (!opensAt || Number.isNaN(opensAt.getTime()) || opensAt > now) return [];
      const activity = (courseModule.activities || []).find(
        (item) => item.is_unlocked && !COMPLETED_STATUSES.has(item.status)
      );
      if (!activity) return [];
      return [
        {
          courseId: allocation.course_id,
          courseName: allocation.course_name || overview?.course?.name || "Course",
          moduleId: courseModule.id,
          moduleTitle: courseModule.title,
          activityId: activity.id,
          activityTitle: activity.title,
          opensAt,
        },
      ];
    })
  );

  return (
    candidates.sort((left, right) => right.opensAt.getTime() - left.opensAt.getTime())[0] || null
  );
}

export function buildDueThisWeekItems({
  typingTests = [],
  quizTests = [],
  continueLearning = null,
  now = new Date(),
}) {
  const typingItems = typingTests
    .filter((test) => isCurrentWeek(test, now))
    .map((test) => ({
      id: `typing-${test.id}`,
      type: "typing",
      title: test.name,
      subtitle: `Week ${test.week_number} typing`,
      path: `/learner/typing-quizzes?category=weekly_typing&test=${test.id}`,
    }));
  const quizItems = quizTests
    .filter((test) => isCurrentWeek(test, now))
    .map((test) => ({
      id: `quiz-${test.id}`,
      type: "quiz",
      title: test.name,
      subtitle: `Week ${test.week_number} quiz`,
      path: `/learner/typing-quizzes?category=weekly_quiz&quiz=${test.id}`,
    }));
  const courseItems = continueLearning
    ? [
        {
          id: `course-${continueLearning.courseId}-${continueLearning.moduleId}`,
          type: "course",
          title: continueLearning.moduleTitle,
          subtitle: `${continueLearning.courseName} | ${continueLearning.activityTitle}`,
          path: activityLearningPath(
            continueLearning.courseId,
            continueLearning.moduleId,
            continueLearning.activityId
          ),
        },
      ]
    : [];

  return [...typingItems, ...quizItems, ...courseItems];
}
