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

function masteryUpdateSql(preserveParameter = "$6") {
  return {
    status: `CASE
         WHEN ${preserveParameter}::boolean
          AND activity_progress.status IN ('completed'::varchar, 'graded'::varchar)
         THEN activity_progress.status
         ELSE EXCLUDED.status
       END`,
    score: `CASE
         WHEN ${preserveParameter}::boolean
         THEN GREATEST(
           COALESCE(activity_progress.score, 0),
           COALESCE(EXCLUDED.score, 0)
         )
         ELSE COALESCE(EXCLUDED.score, activity_progress.score)
       END`,
  };
}

module.exports = { masteryUpdateSql, mergeProgress };
