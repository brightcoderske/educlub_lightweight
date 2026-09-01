// Single grading contract for every quiz surface: module lesson quizzes,
// weekly quizzes and competition quizzes all mark answers through this file.
// Two divergent copies previously disagreed on skipped questions, so keep this
// as the only implementation.

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Tri-state on purpose. Anything that is not recognisably true or false is
// `null` so that a blank answer can never collide with a real boolean.
function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const text = normalizeText(value);
  if (["true", "yes", "t", "y", "1"].includes(text)) return true;
  if (["false", "no", "f", "n", "0"].includes(text)) return false;
  return null;
}

// A learner who submits nothing must never be marked correct, and a question
// with no configured correct answer must never award marks either.
function isBlank(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) {
    return value.every((item) => isBlank(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length === 0 || entries.every(([, item]) => isBlank(item));
  }
  return normalizeText(value) === "";
}

function normalizeAnswer(value, preserveOrder = false) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([key, item]) => [normalizeText(key), normalizeText(item)])
      .sort(([left], [right]) => left.localeCompare(right));
  }
  if (Array.isArray(value)) {
    const normalized = value.map((item) =>
      item && typeof item === "object" ? JSON.stringify(item) : normalizeText(item),
    );
    return preserveOrder ? normalized : [...normalized].sort();
  }
  return [normalizeText(value)].filter(Boolean);
}

function answersMatch(expected, actual, questionType = "") {
  // Order matters: the blank guards run before any comparison so that
  // "no answer given" and "no answer configured" can never match each other.
  if (isBlank(expected) || isBlank(actual)) return false;

  if (questionType === "true_false") {
    const expectedBoolean = normalizeBoolean(expected);
    const actualBoolean = normalizeBoolean(actual);
    if (expectedBoolean === null || actualBoolean === null) return false;
    return expectedBoolean === actualBoolean;
  }

  if (questionType === "short_answer") {
    const accepted = Array.isArray(expected) ? expected : [expected];
    const actualAnswer = normalizeAnswer(actual)[0] || "";
    if (!actualAnswer) return false;
    return accepted.some(
      (answer) => !isBlank(answer) && (normalizeAnswer(answer)[0] || "") === actualAnswer,
    );
  }

  // Matching questions are graded whole: every configured pair must be answered.
  if (questionType === "matching" && expected && typeof expected === "object") {
    const answer = actual && typeof actual === "object" ? actual : {};
    const expectedKeys = Object.keys(expected);
    if (expectedKeys.some((key) => isBlank(answer[key]))) return false;
  }

  const preserveOrder = questionType === "ordering";
  return (
    JSON.stringify(normalizeAnswer(expected, preserveOrder)) ===
    JSON.stringify(normalizeAnswer(actual, preserveOrder))
  );
}

module.exports = { answersMatch, isBlank, normalizeBoolean };
