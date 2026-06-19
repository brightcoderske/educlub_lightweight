import { progressKey } from "./practicePath";

export function calculateStats(targetText, typedText, elapsedSeconds) {
  const minimumScoringSeconds = Math.min(30, Math.max(12, String(targetText || "").length / 5));
  const elapsed = Math.max(1, elapsedSeconds, minimumScoringSeconds);
  const minutes = elapsed / 60;
  const typed = String(typedText || "").slice(0, targetText.length);
  let mistakes = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] !== targetText[index]) mistakes += 1;
  }
  const rawWpm = typed.length / 5 / minutes;
  const netWpm = Math.max(0, rawWpm - mistakes / minutes);
  const accuracy = typed.length ? Math.max(0, ((typed.length - mistakes) / typed.length) * 100) : 0;
  return {
    rawWpm,
    netWpm,
    accuracy,
    mistakes,
    progress: targetText.length ? Math.min(100, (typed.length / targetText.length) * 100) : 0,
  };
}

export function buildProgressMap(rows = []) {
  return rows.reduce((map, row) => {
    map[progressKey(row.track_key, row.level_number, row.activity_key)] = row;
    return map;
  }, {});
}
