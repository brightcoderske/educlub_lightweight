const DONE_STATUSES = new Set(["completed", "graded"]);

function mergeProgress(existing = {}, incoming = {}, preserveMastery = false) {
  if (!preserveMastery) {
    return {
      status: incoming.status,
      score: incoming.score ?? existing.score ?? null,
    };
  }

  const alreadyMastered = DONE_STATUSES.has(existing.status);
  return {
    status: alreadyMastered ? existing.status : incoming.status,
    score: Math.max(Number(existing.score || 0), Number(incoming.score || 0)),
  };
}

module.exports = { mergeProgress };
