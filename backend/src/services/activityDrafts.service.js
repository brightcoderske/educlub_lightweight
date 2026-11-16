const { query } = require("../config/db");
const { assertActivityAccess } = require("./courses.service");

// The editor fields a learner can have in progress. Anything else in the body is
// dropped, so a draft can never grow into a place to park arbitrary data.
const DRAFT_FIELDS = ["code", "html", "css", "js", "input", "text"];
const MAX_DRAFT_BYTES = 256 * 1024;

function httpError(statusCode, message, extra = {}) {
  return Object.assign(new Error(message), { statusCode }, extra);
}

function parseJson(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function normalizeDraftContent(content = {}) {
  const normalized = {};
  for (const field of DRAFT_FIELDS) {
    if (typeof content[field] === "string") normalized[field] = content[field];
  }
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DRAFT_BYTES) {
    throw httpError(413, "This work is too large to save. Split it up or remove some of it.");
  }
  return serialized;
}

async function requireLearnerActivity(activityId, user) {
  const { activity, learner } = await assertActivityAccess(activityId, user);
  if (!activity) throw httpError(404, "Activity not found or not available.");
  if (!learner) throw httpError(403, "Only learners have saved work.");
  return { activity, learner };
}

function shapeDraft(row) {
  if (!row) return null;
  return { content: parseJson(row.content), revision: Number(row.revision), updated_at: row.updated_at };
}

async function readDraft(learnerId, activityId) {
  const result = await query(
    `SELECT content, revision, updated_at FROM activity_drafts
     WHERE learner_id = $1 AND activity_id = $2`,
    [learnerId, activityId],
  );
  return shapeDraft(result.rows[0]);
}

/**
 * What to put back in the editor when the learner opens an activity: their
 * draft when there is one, and their last submission either way, so work
 * submitted before drafts existed comes back too.
 */
async function getActivityWork(activityId, user) {
  const { learner } = await requireLearnerActivity(activityId, user);
  const [draft, submission] = await Promise.all([
    readDraft(learner.id, activityId),
    query(
      `SELECT content, submitted_at FROM activity_submissions
       WHERE learner_id = $1 AND activity_id = $2`,
      [learner.id, activityId],
    ),
  ]);
  const submitted = submission.rows[0];
  return {
    draft,
    submission: submitted
      ? { content: parseJson(submitted.content), submitted_at: submitted.submitted_at }
      : null,
  };
}

/**
 * Saves the learner's work in progress. `base_revision` is the revision the
 * page last loaded or saved; when the stored draft has moved on, another tab or
 * device saved newer work, and overwriting it would lose that work, so the
 * save is refused with the newer draft attached instead.
 */
async function saveActivityDraft(activityId, user, body = {}) {
  const { learner } = await requireLearnerActivity(activityId, user);
  const content = normalizeDraftContent(body.content || {});
  const baseRevision = Number(body.base_revision || 0);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) {
    throw httpError(400, "base_revision must be a whole number.");
  }

  const updated = await query(
    `UPDATE activity_drafts
     SET content = $1, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
     WHERE learner_id = $2 AND activity_id = $3 AND revision = $4`,
    [content, learner.id, activityId, baseRevision],
  );
  if (updated.rowCount > 0) return readDraft(learner.id, activityId);

  if (baseRevision === 0) {
    try {
      await query(
        `INSERT INTO activity_drafts (learner_id, activity_id, content, revision)
         VALUES ($1, $2, $3, 1)`,
        [learner.id, activityId, content],
      );
      return readDraft(learner.id, activityId);
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") throw error;
    }
  }

  throw httpError(409, "Newer work was saved from another tab or device.", {
    draft: await readDraft(learner.id, activityId),
  });
}

module.exports = { getActivityWork, saveActivityDraft, normalizeDraftContent, DRAFT_FIELDS };
