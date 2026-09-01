// Authoritative typing scoring. Graded typing tests and the typing tutor both
// mark through this file so a learner sees one consistent number everywhere.
//
// Three rules matter for fair marking:
//  1. Accuracy is measured against the passage the learner was asked to type,
//     not against what they actually typed. Otherwise stopping after three
//     words scores 100% accuracy.
//  2. Mistakes are counted with a shortest-edit alignment, so a dropped or
//     doubled character costs one mark instead of shifting everything after it
//     out of position and failing the rest of the line.
//  3. Elapsed time has a floor. It arrives from the browser, and without a
//     lower bound a forged value produces an impossible words-per-minute.

// Alignment is quadratic, so very long passages fall back to a positional
// comparison rather than stalling the request. Real lesson passages are far
// below this.
const MAX_ALIGNED_LENGTH = 4000;

// Below this many seconds a burst of typing says nothing reliable about speed.
function minimumScoringSeconds(passage) {
  return Math.min(30, Math.max(12, String(passage || "").length / 5));
}

function tokenizeWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Levenshtein distance: substitutions, omissions and insertions each cost one.
// Two rolling rows keep memory proportional to the shorter side.
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
      const substitution =
        previous[column - 1] + (expected[row - 1] === typed[column - 1] ? 0 : 1);
      current[column] = Math.min(substitution, previous[column] + 1, current[column - 1] + 1);
    }
    previous = current;
  }
  return previous[typed.length];
}

function clampDurationSeconds(passage, durationSeconds, maximumSeconds = null) {
  const requested = Number(durationSeconds);
  const floor = minimumScoringSeconds(passage);
  const ceiling = Number(maximumSeconds);
  const safe = Number.isFinite(requested) && requested > 0 ? requested : floor;
  const capped = Number.isFinite(ceiling) && ceiling > 0 ? Math.min(safe, ceiling) : safe;
  return Math.max(floor, capped);
}

/**
 * @param {string} passage             text the learner was asked to type
 * @param {string} typedText           what the learner actually typed
 * @param {number} durationSeconds     elapsed time reported by the client
 * @param {number|null} maximumSeconds lesson time limit, when one is set
 */
function scoreTypingAttempt(passage, typedText, durationSeconds, maximumSeconds = null) {
  const expected = String(passage || "");
  const typed = String(typedText || "").slice(0, expected.length || undefined);
  const seconds = clampDurationSeconds(expected, durationSeconds, maximumSeconds);
  const minutes = seconds / 60;

  const grossWpm = typed.length / 5 / minutes;

  // Typos are counted only across the stretch the learner actually reached.
  // Whatever they never got to is charged separately as unfinished work, so a
  // careful but slow learner is not also marked inaccurate.
  const attempted = expected.slice(0, typed.length);
  const mistakes = editDistance(attempted, typed);
  const unfinished = Math.max(0, expected.length - typed.length);
  const totalCharacters = Math.max(expected.length, 1);
  const accuracy = ((totalCharacters - mistakes - unfinished) / totalCharacters) * 100;

  // Accuracy is judged per character so a single slipped key in a short drill
  // is not a total loss. Speed uses the standard net words-per-minute formula,
  // which deducts whole mistyped words: deducting each wrong character instead
  // would wipe out the score of anyone who fumbled one long word.
  const typedWords = tokenizeWords(typed);
  const wordErrors = editDistance(tokenizeWords(attempted), typedWords);
  const finalScore = Math.max(0, grossWpm - wordErrors / minutes);

  return {
    raw_wpm: Number(grossWpm.toFixed(2)),
    accuracy: Number(Math.max(0, Math.min(100, accuracy)).toFixed(2)),
    mistakes,
    word_errors: wordErrors,
    final_score: Number(finalScore.toFixed(2)),
    typed_characters: typed.length,
    expected_characters: expected.length,
    completed_words: typedWords.length,
    expected_words: tokenizeWords(expected).length,
    duration_seconds: Number(seconds.toFixed(2)),
  };
}

module.exports = {
  scoreTypingAttempt,
  clampDurationSeconds,
  minimumScoringSeconds,
  tokenizeWords,
  editDistance,
};
