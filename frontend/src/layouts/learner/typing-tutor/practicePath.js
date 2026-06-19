const trackDefinitions = [
  {
    key: "beginner",
    title: "Beginner",
    description: "Learn finger placement, home row keys, and careful rhythm.",
    baseGoalWpm: 8,
    keys: [
      "asdf jkl;",
      "a s d f j k l ;",
      "fj dk sl a;",
      "sad lad ask flask",
      "a lad asks a dad",
      "fall salad flask",
      "all dads ask flask",
      "jill asks dad",
      "safe flask salad",
      "ask dad; fall safe",
    ],
  },
  {
    key: "intermediate",
    title: "Intermediate",
    description: "Build confidence with words, punctuation, and longer patterns.",
    baseGoalWpm: 16,
    keys: [
      "the quick red fox",
      "plant code learn",
      "bright green school",
      "focus and type",
      "small steps grow",
    ],
  },
  {
    key: "advanced",
    title: "Advanced",
    description: "Type complete sentences with better accuracy under time.",
    baseGoalWpm: 24,
    keys: [
      "Practice builds strong keyboard habits.",
      "Accuracy makes speed easier to grow.",
      "Use both hands and keep your eyes ahead.",
      "Short daily drills help learners improve.",
      "Calm typing is faster than rushed typing.",
    ],
  },
  {
    key: "speed-builder",
    title: "Speed Builder",
    description: "Short timed sprints for learners who already know the keys.",
    baseGoalWpm: 30,
    keys: [
      "skill focus speed growth",
      "learn type improve repeat",
      "quick hands steady mind",
      "fast fingers clean words",
      "daily practice wins",
    ],
  },
  {
    key: "accuracy-master",
    title: "Accuracy Master",
    description: "Slow down just enough to remove errors and finish cleanly.",
    baseGoalWpm: 22,
    keys: [
      "zero errors first",
      "read type check",
      "steady keys steady score",
      "precision before speed",
      "finish clean and confident",
    ],
  },
];

const activityTemplates = [
  { key: "finger-map", title: "Finger Map", seconds: 45, accuracyGoal: 85 },
  { key: "key-hunt", title: "Key Hunt", seconds: 45, accuracyGoal: 88 },
  { key: "glow-key", title: "Glow Key", seconds: 50, accuracyGoal: 90 },
  { key: "word-sprint", title: "Word Sprint", seconds: 60, accuracyGoal: 92 },
  { key: "level-boss", title: "Level Boss", seconds: 75, accuracyGoal: 94 },
];

const activityInstructions = [
  "Rest your fingers on the home row before you start.",
  "Look for the next key, press it, then return your finger home.",
  "Follow the glowing key and keep a steady rhythm.",
  "Type short word groups without rushing.",
  "Finish the level challenge with clean accuracy.",
];

function repeatText(seed, level, activityIndex, trackKey) {
  const baseLength = trackKey === "beginner" ? 52 : 72;
  const targetLength = baseLength + level * 14 + activityIndex * 18;
  let text = seed;
  while (text.length < targetLength) {
    text = `${text} ${seed}`;
  }
  return text.slice(0, targetLength).trim();
}

export function buildTypingPracticePath() {
  return trackDefinitions.map((track) => ({
    ...track,
    levels: Array.from({ length: 10 }, (_, levelIndex) => {
      const levelNumber = levelIndex + 1;
      return {
        number: levelNumber,
        title: `Level ${levelNumber}`,
        goalWpm: track.baseGoalWpm + levelIndex * 2,
        activities: activityTemplates.map((template, activityIndex) => {
          const seed = track.keys[(levelIndex + activityIndex) % track.keys.length];
          return {
            ...template,
            id: `${track.key}-l${levelNumber}-${template.key}`,
            trackKey: track.key,
            levelNumber,
            order: activityIndex + 1,
            goalWpm: track.baseGoalWpm + levelIndex * 2 + activityIndex,
            instruction: activityInstructions[activityIndex],
            text: repeatText(seed, levelNumber, activityIndex, track.key),
          };
        }),
      };
    }),
  }));
}

export function progressKey(trackKey, levelNumber, activityKey) {
  return `${trackKey}:${levelNumber}:${activityKey}`;
}
