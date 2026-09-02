import { progressKey } from "../layouts/learner/typing-tutor/practicePath";
import {
  calculateStats,
  buildProgressMap,
  mergePracticeAttempt,
} from "../layouts/learner/typing-tutor/typingTutorUtils";

test("a slower failed retry preserves the saved pass, best marks and accumulated attempts", () => {
  const previous = {
    track_key: "beginner",
    level_number: 1,
    activity_key: "home",
    passed: true,
    attempts: 4,
    best_net_wpm: 30,
    best_raw_wpm: 32,
    best_accuracy: 100,
    fewest_mistakes: 0,
  };
  const other = { track_key: "beginner", level_number: 1, activity_key: "other", passed: true };
  const result = mergePracticeAttempt([previous, other], {
    ...previous,
    passed: false,
    net_wpm: 10,
    raw_wpm: 12,
    accuracy: 60,
    mistakes: 3,
  });
  const saved = result.find((row) => row.activity_key === "home");
  expect(saved).toMatchObject({
    passed: true,
    attempts: 5,
    best_net_wpm: 30,
    best_raw_wpm: 32,
    best_accuracy: 100,
    fewest_mistakes: 0,
  });
  expect(result).toContain(other);
});

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
