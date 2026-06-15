import {
  buildDueThisWeekItems,
  findActiveWeekLearning,
} from "../layouts/learner/dashboardDueItems";

const currentWeek = {
  week_start_date: "2026-06-15",
  week_end_date: "2026-06-21",
};

test("due this week includes only the current weekly quiz and typing task", () => {
  const items = buildDueThisWeekItems({
    now: new Date("2026-06-17T10:00:00+03:00"),
    typingTests: [
      { id: 1, name: "Week 4 Typing", week_number: 4, ...currentWeek },
      {
        id: 2,
        name: "Week 3 Typing",
        week_number: 3,
        week_start_date: "2026-06-08",
        week_end_date: "2026-06-14",
      },
    ],
    quizTests: [
      { id: 3, name: "Week 4 Quiz", week_number: 4, ...currentWeek },
      {
        id: 4,
        name: "Week 2 Quiz",
        week_number: 2,
        week_start_date: "2026-06-01",
        week_end_date: "2026-06-07",
      },
    ],
  });

  expect(items.map((item) => item.title)).toEqual(["Week 4 Typing", "Week 4 Quiz"]);
  expect(items.map((item) => item.path)).toEqual([
    "/learner/typing-quizzes?category=weekly_typing&test=1",
    "/learner/typing-quizzes?category=weekly_quiz&quiz=3",
  ]);
});

test("due this week includes the active continue-learning module", () => {
  const items = buildDueThisWeekItems({
    now: new Date("2026-06-17T10:00:00+03:00"),
    continueLearning: {
      courseId: 7,
      courseName: "Scratch",
      moduleId: 4,
      moduleTitle: "Loops",
      activityId: 22,
      activityTitle: "Build a dance loop",
    },
  });

  expect(items).toEqual([
    expect.objectContaining({
      type: "course",
      title: "Loops",
      path: "/learner/courses/7/modules/4/learn?activity=22",
    }),
  ]);
});

test("active week learning prefers the latest opened scheduled module", () => {
  const destination = findActiveWeekLearning(
    [
      {
        allocation: { course_id: 7, course_name: "Scratch" },
        overview: {
          modules: [
            {
              id: 3,
              title: "Events",
              opens_at: "2026-06-08T00:00:00Z",
              activities: [{ id: 20, title: "Old task", is_unlocked: true, status: "in_progress" }],
            },
            {
              id: 4,
              title: "Loops",
              opens_at: "2026-06-15T00:00:00Z",
              activities: [
                { id: 22, title: "Dance loop", is_unlocked: true, status: "not_started" },
              ],
            },
          ],
        },
      },
    ],
    new Date("2026-06-17T10:00:00+03:00")
  );

  expect(destination).toMatchObject({
    courseId: 7,
    moduleId: 4,
    moduleTitle: "Loops",
    activityId: 22,
  });
});
