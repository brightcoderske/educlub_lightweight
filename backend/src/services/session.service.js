const crypto = require("node:crypto");
const { query } = require("../config/db");
const { withTransaction } = require("../database/transaction");
const env = require("../config/env");

function hashToken(token) {
  return crypto.createHash("sha256").update(token || "").digest("hex");
}

function lifetimeMs(value = env.refreshTokenExpiresIn) {
  const match = /^(\d+)\s*([smhd])$/i.exec(String(value));
  if (!match) return 7 * 86_400_000;
  return Number(match[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()];
}

async function insertSession(executor, userId, context, familyId) {
  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + lifetimeMs());
  const result = await executor.query(
    `INSERT INTO user_sessions
       (user_id, refresh_token_hash, token_family_id, device_name, ip_address, user_agent, last_used_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING id`,
    [userId, hashToken(token), familyId, context.deviceName || null,
      context.ipAddress || null, context.userAgent || null, expiresAt],
  );
  return { token, expiresAt, id: result.rows[0].id };
}

async function createSession(userId, context = {}) {
  return insertSession({ query }, userId, context, crypto.randomUUID());
}

async function rotateSession(token, context = {}) {
  if (!token) throw new Error("Refresh token required.");
  const outcome = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT us.id, us.user_id, us.token_family_id, us.expires_at, us.revoked_at,
              u.role, u.school_id, u.username, u.is_active
       FROM user_sessions us JOIN users u ON u.id = us.user_id
       WHERE us.refresh_token_hash = $1 FOR UPDATE OF us`,
      [hashToken(token)],
    );
    const current = result.rows[0];
    if (!current) throw new Error("Invalid refresh token.");
    if (!current.is_active) return { failure: "User account is no longer active." };
    if (current.revoked_at) {
      await client.query(
        `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = CASE WHEN revoked_at IS NULL THEN 'token_reuse' ELSE revoke_reason END
         WHERE token_family_id = $1`,
        [current.token_family_id],
      );
      return { failure: "Refresh token reuse detected. Please sign in again." };
    }
    if (new Date(current.expires_at) <= new Date()) {
      await client.query("UPDATE user_sessions SET revoked_at = NOW(), revoke_reason = 'expired' WHERE id = $1", [current.id]);
      return { failure: "Session has expired." };
    }
    const replacement = await insertSession(client, current.user_id, context, current.token_family_id);
    await client.query(
      `UPDATE user_sessions SET revoked_at = NOW(), revoke_reason = 'rotated',
       replaced_by_session_id = $2, last_used_at = NOW() WHERE id = $1`,
      [current.id, replacement.id],
    );
    return {
      ...replacement,
      userId: current.user_id,
      authContext: { userId: current.user_id, role: current.role, schoolId: current.school_id, username: current.username },
    };
  }, { isolationLevel: "SERIALIZABLE" });
  if (outcome.failure) throw new Error(outcome.failure);
  return outcome;
}

async function revokeSession(token, userId = null, reason = "logout") {
  if (!token) return false;
  const result = await query(
    `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()),
     revoke_reason = COALESCE(revoke_reason, $3)
     WHERE refresh_token_hash = $1 AND ($2::integer IS NULL OR user_id = $2)`,
    [hashToken(token), userId, reason],
  );
  return result.rowCount > 0;
}

async function revokeAllSessions(userId, reason = "security_change") {
  await query(
    "UPDATE user_sessions SET revoked_at = NOW(), revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL",
    [userId, reason],
  );
}

module.exports = { createSession, rotateSession, revokeSession, revokeAllSessions, hashToken, lifetimeMs };
