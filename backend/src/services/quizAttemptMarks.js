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

function normalizeQuestionMarks(questions = [], questionMarks = {}) {
  const feedback = {};
  let earnedPoints = 0;
  let totalPoints = 0;

  questions.forEach((question) => {
    const maxPoints = Number(question.points || 0);
    const rawMark = questionMarks[question.id] ?? questionMarks[String(question.id)];
    const points = Number(rawMark);

    if (!Number.isFinite(points)) {
      throw new Error(`Enter a valid mark for question ${question.id}.`);
    }
    if (points < 0 || points > maxPoints) {
      throw new Error(`Question marks must be between 0 and ${maxPoints}.`);
    }

    const status = points === maxPoints ? "right" : points > 0 ? "partial" : "wrong";
    feedback[question.id] = {
      correct: status === "right",
      status,
      points,
      max_points: maxPoints,
    };
    earnedPoints += points;
    totalPoints += maxPoints;
  });

  return {
    earnedPoints,
    totalPoints,
    score: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    feedback,
  };
}

module.exports = { normalizeAttemptMarks, normalizeQuestionMarks };
