/**
 * How much of a module (or course) a learner has opened, apart from the mark.
 *
 * The mark averages only the activities attempted, so one finished reading
 * activity marks a ten-activity module 100%. Coverage answers the other
 * question: how far into it the learner has got.
 *
 * Progress saved before opened counts existed (closed terms) has no
 * opened_activities, so completed activities stand in for it there.
 */
export function openedShare(progress) {
  const total = Number(progress?.total_activities) || 0;
  const opened = Number(progress?.opened_activities ?? progress?.completed_activities) || 0;
  const percent =
    progress?.opened_percent ?? (total > 0 ? Math.round((Math.min(opened, total) / total) * 100) : 0);
  return { opened, total, percent: Number(percent) || 0 };
}

/**
 * Bar colour for coverage: grey before anything is opened, then red, orange,
 * blue, and green once every activity has been opened.
 */
export function coverageColor(percent) {
  const value = Number(percent) || 0;
  if (value <= 0) return "secondary";
  if (value < 40) return "error";
  if (value < 70) return "warning";
  if (value < 100) return "info";
  return "success";
}
