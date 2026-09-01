import { progressKey } from "./practicePath";

// Mirrors backend/src/services/typingScoring.js. The server recalculates every
// saved mark, so this must follow the same rules or the learner would see one
// result on screen and a different one in their progress.

const MAX_ALIGNED_LENGTH = 4000;

export function minimumScoringSeconds(targetText) {
  return Math.min(30, Math.max(12, String(targetText || "").length / 5));
}

function tokenizeWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Levenshtein distance over characters or words. Aligning instead of comparing
// position by position means one dropped character costs one mark rather than
// shifting everything after it out of place.
function editDistance(expected, typed) {
  if (expected.length === 0) return typed.length;
  if (typed.length === 0) return expected.length;

  if (expected.length * typed.length > MAX_ALIGNED_LENGTH * MAX_ALIGNED_LENGTH) {
    let positional = Math.abs(expected.length - typed.length);
    const shared = Math.min(expected.length, typed.length);
    for (let index = 0; index < shared; index += 1) {
      if (expected[index] !== typed[index]) positional += 1;
    }
    return positional;
  }

  let previous = Array.from({ length: typed.length + 1 }, (unused, index) => index);
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= typed.length; column += 1) {
      const substitution = previous[column - 1] + (expected[row - 1] === typed[column - 1] ? 0 : 1);
      current[column] = Math.min(substitution, previous[column] + 1, current[column - 1] + 1);
    }
    previous = current;
  }
  return previous[typed.length];
}

export function calculateStats(targetText, typedText, elapsedSeconds) {
  const expected = String(targetText || "");
  const typed = String(typedText || "").slice(0, expected.length);
  const elapsed = Math.max(1, Number(elapsedSeconds) || 0, minimumScoringSeconds(expected));
  const minutes = elapsed / 60;

  const rawWpm = typed.length / 5 / minutes;

  // Accuracy is scored against the passage, not against what was typed, so
  // stopping after three words can no longer read as 100% accurate.
  const attempted = expected.slice(0, typed.length);
  const mistakes = editDistance(attempted, typed);
  const unfinished = Math.max(0, expected.length - typed.length);
  const totalCharacters = Math.max(expected.length, 1);

  // Speed uses the standard net words-per-minute deduction of whole mistyped
  // words, so fumbling one long word does not erase the whole attempt.
  const wordErrors = editDistance(tokenizeWords(attempted), tokenizeWords(typed));
  const netWpm = Math.max(0, rawWpm - wordErrors / minutes);
  const accuracy = Math.max(
    0,
    Math.min(100, ((totalCharacters - mistakes - unfinished) / totalCharacters) * 100)
  );

  return {
    rawWpm,
    netWpm,
    accuracy,
    mistakes,
    wordErrors,
    progress: expected.length ? Math.min(100, (typed.length / expected.length) * 100) : 0,
  };
}

export function buildProgressMap(rows = []) {
  return rows.reduce((map, row) => {
    map[progressKey(row.track_key, row.level_number, row.activity_key)] = row;
    return map;
  }, {});
}
