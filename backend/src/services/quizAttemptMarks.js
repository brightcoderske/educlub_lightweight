function normalizeAttemptMarks(value, total) {
  const earnedPoints = Number(value);
  const totalPoints = Number(total);

  if (!Number.isFinite(earnedPoints)) {
    throw new Error("Enter a valid mark.");
  }
  if (!Number.isFinite(totalPoints) || totalPoints <= 0) {
    throw new Error("This quiz does not have a valid total mark.");
  }
  if (earnedPoints < 0 || earnedPoints > totalPoints) {
    throw new Error(`Marks must be between 0 and ${totalPoints}.`);
  }

  return {
    earnedPoints,
    totalPoints,
    score: Math.round((earnedPoints / totalPoints) * 100),
  };
}

module.exports = { normalizeAttemptMarks };
