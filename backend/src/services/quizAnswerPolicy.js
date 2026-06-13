function normalizeBoolean(value) {
  return value === true || value === "true" || value === "yes" || value === 1;
}

function normalizeAnswer(value, preserveOrder = false) {
  const normalizeText = (item) =>
    String(item ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([key, item]) => [normalizeText(key), normalizeText(item)])
      .sort(([left], [right]) => left.localeCompare(right));
  }
  if (Array.isArray(value)) {
    const normalized = value.map(normalizeText);
    return preserveOrder ? normalized : normalized.sort();
  }
  return [normalizeText(value)].filter(Boolean);
}

function answersMatch(expected, actual, questionType = "") {
  if (questionType === "true_false") {
    return normalizeBoolean(expected) === normalizeBoolean(actual);
  }
  if (questionType === "short_answer") {
    const accepted = Array.isArray(expected) ? expected : [expected];
    const actualAnswer = normalizeAnswer(actual)[0] || "";
    return accepted.some((answer) => (normalizeAnswer(answer)[0] || "") === actualAnswer);
  }
  const preserveOrder = questionType === "ordering";
  return (
    JSON.stringify(normalizeAnswer(expected, preserveOrder)) ===
    JSON.stringify(normalizeAnswer(actual, preserveOrder))
  );
}

module.exports = { answersMatch };
