const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeStreak,
  localDayKey,
  previousDayKey,
} = require("../src/services/streak.service");

const NAIROBI = "Africa/Nairobi";
// A fixed "now" so these never depend on the day the suite runs.
const NOW = new Date("2026-09-03T09:00:00Z");

function at(day, time = "10:00:00Z") {
  return new Date(`${day}T${time}`);
}

test("a learner with no recorded activity has no streak", () => {
  assert.deepEqual(computeStreak([], { now: NOW, timeZone: NAIROBI }), {
    current: 0,
    longest: 0,
    lastActiveOn: null,
    activeToday: false,
  });
});

test("consecutive days ending today count, and today is reported", () => {
  const streak = computeStreak(
    [at("2026-09-01"), at("2026-09-02"), at("2026-09-03")],
    { now: NOW, timeZone: NAIROBI },
  );

  assert.equal(streak.current, 3);
  assert.equal(streak.longest, 3);
  assert.equal(streak.lastActiveOn, "2026-09-03");
  assert.equal(streak.activeToday, true);
});

test("several sessions in one day are one day of the streak", () => {
  const streak = computeStreak(
    [
      at("2026-09-02", "06:00:00Z"),
      at("2026-09-02", "11:30:00Z"),
      at("2026-09-02", "17:45:00Z"),
      at("2026-09-03"),
    ],
    { now: NOW, timeZone: NAIROBI },
  );

  assert.equal(streak.current, 2);
});

test("a streak that ended yesterday survives until the end of today", () => {
  const streak = computeStreak([at("2026-09-01"), at("2026-09-02")], {
    now: NOW,
    timeZone: NAIROBI,
  });

  assert.equal(streak.current, 2, "yesterday still counts - today is not over");
  assert.equal(streak.activeToday, false);
});

test("a gap of a full day breaks the current streak but not the record", () => {
  const streak = computeStreak(
    [
      at("2026-08-20"),
      at("2026-08-21"),
      at("2026-08-22"),
      at("2026-08-23"),
      // Nothing until well after: the current streak has lapsed.
      at("2026-08-30"),
    ],
    { now: NOW, timeZone: NAIROBI },
  );

  assert.equal(streak.current, 0);
  assert.equal(streak.longest, 4);
  assert.equal(streak.lastActiveOn, "2026-08-30");
});

test("days are bucketed in the school's timezone, not UTC", () => {
  // 22:30 UTC is 01:30 the next morning in Nairobi. Bucketed by UTC these are
  // two separate days; locally they are one late-night session plus the day
  // before it, which is what the learner actually experienced.
  const lateNight = new Date("2026-09-02T22:30:00Z");

  assert.equal(localDayKey(lateNight, NAIROBI), "2026-09-03");
  assert.equal(localDayKey(lateNight, "UTC"), "2026-09-02");

  const streak = computeStreak([at("2026-09-02", "05:00:00Z"), lateNight], {
    now: NOW,
    timeZone: NAIROBI,
  });

  assert.equal(streak.current, 2, "2 Sept morning and 3 Sept small hours");
});

test("stepping back a day crosses months and leap days by the calendar", () => {
  assert.equal(previousDayKey("2026-09-01"), "2026-08-31");
  assert.equal(previousDayKey("2026-01-01"), "2025-12-31");
  assert.equal(previousDayKey("2024-03-01"), "2024-02-29");
  assert.equal(previousDayKey("2026-03-01"), "2026-02-28");
});

test("a streak spanning a month boundary is not broken by the rollover", () => {
  const streak = computeStreak(
    [at("2026-08-30"), at("2026-08-31"), at("2026-09-01"), at("2026-09-02")],
    { now: NOW, timeZone: NAIROBI },
  );

  assert.equal(streak.current, 4);
});

test("unusable timestamps are ignored rather than counted as a day", () => {
  const streak = computeStreak([null, undefined, "not a date", at("2026-09-03")], {
    now: NOW,
    timeZone: NAIROBI,
  });

  assert.equal(streak.current, 1);
  assert.equal(streak.lastActiveOn, "2026-09-03");
});

test("out of order timestamps produce the same streak as sorted ones", () => {
  const days = [at("2026-09-02"), at("2026-08-31"), at("2026-09-03"), at("2026-09-01")];

  assert.equal(computeStreak(days, { now: NOW, timeZone: NAIROBI }).current, 4);
});
