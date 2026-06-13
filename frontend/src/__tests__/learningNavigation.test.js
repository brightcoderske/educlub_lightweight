import {
  activityLearningPath,
  findActivityNavigation,
  findContinueLearning,
  resolveInitialActivity,
} from "../layouts/learner/learningNavigation";

const activities = [
  { id: 1, status: "completed", is_unlocked: true, progress_updated_at: "2026-06-10T08:00:00Z" },
  { id: 2, status: "in_progress", is_unlocked: true, progress_updated_at: "2026-06-12T08:00:00Z" },
  { id: 3, status: "not_started", is_unlocked: false },
];

test("continue learning prefers the most recently touched incomplete activity", () => {
  const destination = findContinueLearning([
    {
      allocation: { course_id: 7, course_name: "Web" },
      overview: {
        modules: [{ id: 4, title: "HTML", position: 1, activities }],
      },
    },
  ]);

  expect(destination).toMatchObject({
    courseId: 7,
    moduleId: 4,
    activityId: 2,
    courseName: "Web",
    moduleTitle: "HTML",
  });
});

test("activity navigation supports previous and blocks a locked next activity", () => {
  expect(findActivityNavigation(activities, 2)).toEqual({
    previous: activities[0],
    next: null,
  });
});

test("direct activity links open only unlocked activities", () => {
  expect(resolveInitialActivity(activities, "2")).toBe(2);
  expect(resolveInitialActivity(activities, "3")).toBe(2);
  expect(activityLearningPath(7, 4, 2)).toBe("/learner/courses/7/modules/4/learn?activity=2");
});
