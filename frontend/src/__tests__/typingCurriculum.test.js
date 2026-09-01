import { buildTypingPracticePath, fingerForKey } from "../layouts/learner/typing-tutor/practicePath";

const tracks = buildTypingPracticePath();
const allActivities = tracks.flatMap((track) =>
  track.levels.flatMap((level) =>
    level.activities.map((activity) => ({ track, level, activity }))
  )
);

test("every activity has something to type", () => {
  const empty = allActivities.filter(({ activity }) => !activity.text.trim());
  expect(empty).toHaveLength(0);
});

test("the five activities in a level are five different exercises", () => {
  // The first release repeated one seed phrase at five lengths, so every
  // activity in a level was the same drill under a different name.
  const repeated = [];
  tracks.forEach((track) => {
    track.levels.forEach((level) => {
      const openings = new Set(level.activities.map((activity) => activity.text.slice(0, 45)));
      if (openings.size < level.activities.length) repeated.push(`${track.key} L${level.number}`);
    });
  });
  expect(repeated).toEqual([]);
});

test("no passage is reused anywhere in the tutor", () => {
  const texts = allActivities.map(({ activity }) => activity.text);
  expect(new Set(texts).size).toBe(texts.length);
});

test("a learner typing at the goal speed always has time to finish", () => {
  const impossible = allActivities.filter(({ activity }) => {
    const secondsNeeded = (activity.text.length / 5 / activity.goalWpm) * 60;
    return secondsNeeded > activity.seconds;
  });
  expect(impossible).toHaveLength(0);
});

test("beginner levels only use keys the learner has already been taught", () => {
  const beginner = tracks.find((track) => track.key === "beginner");
  const learned = new Set();
  beginner.levels.forEach((level) => {
    level.newKeys
      .split(/\s+/)
      .filter(Boolean)
      .forEach((key) => learned.add(key));

    level.activities.forEach((activity) => {
      const unknown = [...activity.text.toLowerCase()].filter(
        (character) => /[a-z;]/.test(character) && !learned.has(character)
      );
      expect({ level: level.number, activity: activity.key, unknown: [...new Set(unknown)] }).toEqual(
        { level: level.number, activity: activity.key, unknown: [] }
      );
    });
  });
});

test("the beginner track starts on the home row and ends on sentences", () => {
  const beginner = tracks.find((track) => track.key === "beginner");
  expect(beginner.levels[0].newKeys).toBe("f j");
  expect(beginner.levels[0].activities[0].text).toMatch(/^[fj ]+$/);

  const finalBoss = beginner.levels[9].activities[4];
  expect(finalBoss.text.split(/\s+/).length).toBeGreaterThan(20);
});

test("passages grow from key drills to full paragraphs", () => {
  const firstDrill = tracks[0].levels[0].activities[0].text.length;
  const finalParagraph = tracks[2].levels[9].activities[4].text.length;
  expect(finalParagraph).toBeGreaterThan(firstDrill * 5);
  expect(finalParagraph).toBeGreaterThan(400);
});

test("every level explains what it teaches", () => {
  tracks.forEach((track) => {
    track.levels.forEach((level) => {
      expect(level.focus).toBeTruthy();
      expect(level.teaches.length).toBeGreaterThan(20);
      level.activities.forEach((activity) => {
        expect(activity.instruction).toContain(level.focus);
        expect(activity.teaches).toBeTruthy();
      });
    });
  });
});

test("finger hints cover the whole keyboard, not just the home row", () => {
  expect(fingerForKey("f")).toMatch(/left index/);
  expect(fingerForKey(";")).toMatch(/right little/);
  expect(fingerForKey("p")).toMatch(/right little/);
  expect(fingerForKey("b")).toMatch(/left index/);
  expect(fingerForKey(" ")).toMatch(/thumb/);
  expect(fingerForKey("R")).toMatch(/Shift/);
});

test("activity keys are unchanged so recorded learner progress still matches", () => {
  const keys = tracks[0].levels[0].activities.map((activity) => activity.key);
  expect(keys).toEqual(["finger-map", "key-hunt", "glow-key", "word-sprint", "level-boss"]);
});
