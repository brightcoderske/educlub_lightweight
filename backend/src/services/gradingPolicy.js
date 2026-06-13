function normalizeActivityGrade(value, maxPoints = 0) {
  if (value === undefined || value === null || value === "") return null;

  const score = Number(value);
  if (!Number.isFinite(score)) {
    throw new Error("Grade must be a valid number.");
  }
  if (score < 0) {
    throw new Error("Grade cannot be below zero.");
  }

  const maximum = Number(maxPoints || 0);
  if (maximum > 0 && score > maximum) {
    throw new Error(`Grade cannot exceed ${maximum}.`);
  }
  return score;
}

module.exports = { normalizeActivityGrade };
