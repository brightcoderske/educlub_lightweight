export function normalizeAcceptableAnswers(value) {
  const answers = Array.isArray(value) ? value : [value];
  const normalized = answers.map((answer) => String(answer ?? ""));
  return normalized.length ? normalized : [""];
}

export function addAcceptableAnswer(value) {
  return [...normalizeAcceptableAnswers(value), ""];
}

export function updateAcceptableAnswer(value, index, answer) {
  return normalizeAcceptableAnswers(value).map((current, currentIndex) =>
    currentIndex === index ? answer : current
  );
}

export function removeAcceptableAnswer(value, index) {
  const remaining = normalizeAcceptableAnswers(value).filter(
    (_, currentIndex) => currentIndex !== index
  );
  return remaining.length ? remaining : [""];
}
