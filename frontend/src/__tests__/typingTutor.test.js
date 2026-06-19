import { progressKey } from "../layouts/learner/typing-tutor/practicePath";
import { calculateStats, buildProgressMap } from "../layouts/learner/typing-tutor/typingTutorUtils";

test("calculates lightweight typing tutor stats", () => {
  const stats = calculateStats("asdf", "asxf", 60);

  expect(stats.rawWpm).toBeCloseTo(0.8);
  expect(stats.netWpm).toBe(0);
  expect(stats.accuracy).toBe(75);
  expect(stats.mistakes).toBe(1);
  expect(stats.progress).toBe(100);
});

test("uses a realistic minimum scoring window for very fast short attempts", () => {
  const stats = calculateStats("asdf jkl; asdf jkl;", "asdf jkl; asdf jkl;", 1);

  expect(stats.netWpm).toBeLessThan(30);
  expect(stats.accuracy).toBe(100);
});

test("maps typing tutor progress by track level and activity", () => {
  const map = buildProgressMap([
    {
      track_key: "beginner",
      level_number: 1,
      activity_key: "finger-map",
      passed: true,
    },
  ]);

  expect(map[progressKey("beginner", 1, "finger-map")].passed).toBe(true);
});
