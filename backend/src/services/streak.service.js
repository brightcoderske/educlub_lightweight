const { query } = require("../config");
const env = require("../config/env");

// How far back a streak is worth reconstructing. A learner who has been away
// longer has a current streak of zero either way, and this keeps the row count
// bounded for a learner with years of history.
const STREAK_WINDOW_DAYS = 400;

/**
 * A streak counts calendar days on which the learner did something, from any of
 * the five places activity is recorded. Days are bucketed in the school's own
 * timezone, not UTC: eduClub runs at UTC+3, so an evening session at 21:00 local
 * is 18:00 UTC the same day, but bucketing by UTC would push a late-night one
 * onto the day before and break a streak the learner did not break.
 */
const TIMEZONE = env.learnerTimezone;

const dayFormatters = new Map();

function dayFormatter(timeZone) {
  if (!dayFormatters.has(timeZone)) {
    dayFormatters.set(
      timeZone,
      // en-CA gives YYYY-MM-DD, which sorts and compares as a plain string.
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  }
  return dayFormatters.get(timeZone);
}

function localDayKey(value, timeZone = TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dayFormatter(timeZone).format(date);
}

// Day keys are compared by stepping a real date, not by subtracting strings, so
// month ends, leap days and any DST shift in the zone are handled by the
// calendar rather than by arithmetic that assumes 24-hour days.
function previousDayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {Array<Date|string>} timestamps every recorded activity moment
 * @returns {{current: number, longest: number, lastActiveOn: string|null, activeToday: boolean}}
 */
function computeStreak(timestamps, { now = new Date(), timeZone = TIMEZONE } = {}) {
  const days = new Set();
  for (const timestamp of timestamps) {
    const key = localDayKey(timestamp, timeZone);
    if (key) days.add(key);
  }

  if (days.size === 0) {
    return { current: 0, longest: 0, lastActiveOn: null, activeToday: false };
  }

  const sorted = [...days].sort();
  const lastActiveOn = sorted[sorted.length - 1];

  let longest = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    run = sorted[index - 1] === previousDayKey(sorted[index]) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Yesterday still counts as an unbroken streak: the learner has the rest of
  // today to keep it. Anything older has already lapsed.
  const today = localDayKey(now, timeZone);
  const yesterday = previousDayKey(today);
  let current = 0;
  if (lastActiveOn === today || lastActiveOn === yesterday) {
    current = 1;
    let cursor = lastActiveOn;
    while (days.has(previousDayKey(cursor))) {
      cursor = previousDayKey(cursor);
      current += 1;
    }
  }

  return { current, longest, lastActiveOn, activeToday: lastActiveOn === today };
}

// Five tables record a learner doing something. Bucketing happens in JavaScript
// rather than SQL because the date functions and timezone support differ
// between PostgreSQL and the MariaDB the application also runs on, and getting
// the day boundary wrong is the one thing a streak cannot survive.
const ACTIVITY_SOURCES = `
  SELECT completed_at AS moment FROM activity_progress
   WHERE learner_id = $1 AND completed_at IS NOT NULL
  UNION ALL
  SELECT submitted_at AS moment FROM quiz_attempts WHERE learner_id = $1
  UNION ALL
  SELECT submitted_at AS moment FROM typing_attempts WHERE learner_id = $1
  UNION ALL
  SELECT submitted_at AS moment FROM typing_practice_attempts WHERE learner_id = $1
  UNION ALL
  SELECT submitted_at AS moment FROM quiz_test_attempts WHERE learner_id = $1
`;

async function getLearnerStreak(learnerId, { now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const result = await query(
    `SELECT moment FROM (${ACTIVITY_SOURCES}) AS learner_activity
      WHERE moment >= $2
      ORDER BY moment DESC`,
    [learnerId, cutoff],
  );

  return {
    ...computeStreak(
      result.rows.map((row) => row.moment),
      { now },
    ),
    timeZone: TIMEZONE,
  };
}

module.exports = {
  computeStreak,
  getLearnerStreak,
  localDayKey,
  previousDayKey,
  STREAK_WINDOW_DAYS,
  TIMEZONE,
};
