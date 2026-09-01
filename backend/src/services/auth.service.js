const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { query, runWithDbContext } = require("../config");
const env = require("../config/env");
const { sendMFACode, sendPasswordResetLinkEmail } = require("../utils/email");
const privacyService = require("./privacy.service");
const sessionService = require("./session.service");

function validatePasswordPolicy(password) {
  const failures = [];

  if (!password || password.length < 8) {
    failures.push("at least 8 characters");
  }
  if (!/[a-z]/.test(password || "")) {
    failures.push("one lowercase letter");
  }
  if (!/[A-Z]/.test(password || "")) {
    failures.push("one uppercase letter");
  }
  if (!/[0-9]/.test(password || "")) {
    failures.push("one number");
  }
  if (!/[^A-Za-z0-9]/.test(password || "")) {
    failures.push("one symbol");
  }
  if (/\s/.test(password || "")) {
    failures.push("no spaces");
  }

  if (failures.length > 0) {
    throw new Error(`Password must include ${failures.join(", ")}.`);
  }
}

function isDeliverableEmail(email) {
  return Boolean(
    email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !email.endsWith(".local"),
  );
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashTrustedDeviceToken(token) {
  return crypto
    .createHash("sha256")
    .update(token || "")
    .digest("hex");
}

function hashMfaCode(code) {
  return crypto.createHmac("sha256", env.jwtSecret).update(String(code || "")).digest("hex");
}

function safeHashEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      schoolId: user.school_id,
      username: user.username,
      jti: crypto.randomUUID(),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

async function buildAuthResponse(user, extra = {}) {
  const consentRequired = !(await privacyService.hasCurrentConsent(user.id));
  const school = user.school_id
    ? (
        await query(
          "SELECT name, logo_url FROM schools WHERE id = $1 AND is_active = true",
          [user.school_id],
        )
      ).rows[0]
    : null;

  return {
    token: createAuthToken(user),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      schoolId: user.school_id,
      username: user.username,
      schoolName: school?.name || null,
      schoolLogoUrl: school?.logo_url || null,
      forcePasswordReset: user.force_password_reset,
      consentRequired,
    },
    ...extra,
  };
}

async function refreshSession(userId) {
  const result = await query(
    `SELECT u.*
     FROM users u
     WHERE u.id = $1
       AND u.is_active = true`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error("User account is no longer active.");
  }
  return buildAuthResponse(user);
}

async function isTrustedMfaDevice(userId, trustedDeviceToken) {
  if (!trustedDeviceToken) {
    return false;
  }

  const tokenHash = hashTrustedDeviceToken(trustedDeviceToken);
  const result = await query(
    `UPDATE trusted_mfa_devices
     SET last_used_at = NOW()
     WHERE user_id = $1
       AND token_hash = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     RETURNING id`,
    [userId, tokenHash],
  );

  return result.rows.length > 0;
}

async function createTrustedMfaDevice(userId, ipAddress, userAgent) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashTrustedDeviceToken(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await query(
    `INSERT INTO trusted_mfa_devices (
       user_id, token_hash, ip_address, user_agent, expires_at
     )
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, ipAddress || null, userAgent || null, expiresAt],
  );

  return {
    trustedDeviceToken: token,
    trustedDeviceExpiresAt: expiresAt.toISOString(),
  };
}

function normalizeMfaPolicy(value) {
  return {
    system_admin: value?.system_admin !== false,
    school_admin: value?.school_admin !== false,
  };
}

async function getMfaPolicy() {
  const result = await query(
    "SELECT value FROM system_settings WHERE `key` = 'mfa_policy'",
  );
  return normalizeMfaPolicy(result.rows[0]?.value);
}

async function updateMfaPolicy(policy, updatedByUserId) {
  const nextPolicy = normalizeMfaPolicy(policy);
  const result = await query(
    `INSERT INTO system_settings (\`key\`, value, updated_by_user_id, updated_at)
     VALUES ('mfa_policy', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()
     RETURNING value`,
    [JSON.stringify(nextPolicy), updatedByUserId],
  );

  return normalizeMfaPolicy(result.rows[0]?.value);
}

async function isMfaRequiredForUser(user) {
  if (user.role !== "system_admin" && user.role !== "school_admin") {
    return false;
  }

  const policy = await getMfaPolicy();
  return Boolean(policy[user.role]);
}

async function revokeTrustedMfaDevices(userId) {
  await query(
    `UPDATE trusted_mfa_devices
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

async function createPasswordResetToken(
  user,
  requestedByUserId,
  ipAddress,
  userAgent,
) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await runWithDbContext(
    {
      userId: requestedByUserId || user.id,
      role: "system_admin",
      schoolId: user.school_id || null,
    },
    async () => {
      await query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id],
      );

      await query(
        `INSERT INTO password_reset_tokens (
           user_id, token_hash, requested_by_user_id, expires_at, ip_address, user_agent
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          tokenHash,
          requestedByUserId || null,
          expiresAt,
          ipAddress || null,
          userAgent || null,
        ],
      );
    },
  );

  return {
    token,
    resetUrl: `${env.frontendUrl}/authentication/set-password?token=${token}`,
    expiresMinutes: 30,
  };
}

async function sendPasswordResetLinkForUser(
  user,
  requestedByUserId,
  ipAddress,
  userAgent,
) {
  if (!isDeliverableEmail(user.email)) {
    throw new Error("This account does not have a reachable email address.");
  }

  const reset = await createPasswordResetToken(
    user,
    requestedByUserId,
    ipAddress,
    userAgent,
  );
  const sent = await sendPasswordResetLinkEmail(
    user.email,
    user.full_name,
    reset.resetUrl,
    reset.expiresMinutes,
  );

  if (!sent) {
    throw new Error("Could not send password reset email.");
  }

  return {
    message: "Password reset link sent. The link expires in 30 minutes.",
  };
}

async function requestPasswordReset(identifier, ipAddress, userAgent) {
  const generic = {
    message:
      "If the account has a reachable email address, a password reset link has been sent. If you cannot access that email, contact your System Admin or School Admin for help resetting your password.",
  };

  const result = await query(
    `SELECT id, email, full_name, role, school_id, username
     FROM users
     WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1))
       AND is_active = true`,
    [identifier],
  );
  const user = result.rows[0];

  if (!user || !isDeliverableEmail(user.email)) {
    return generic;
  }

  try {
    await sendPasswordResetLinkForUser(user, null, ipAddress, userAgent);
  } catch (error) {
    console.error("Public password reset email error:", error);
  }

  return generic;
}

async function confirmPasswordReset(token, newPassword) {
  validatePasswordPolicy(newPassword);

  const tokenHash = hashResetToken(token || "");
  const result = await runWithDbContext(
    { userId: "", role: "system_admin", schoolId: null },
    () =>
      query(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.is_active
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token_hash = $1`,
        [tokenHash],
      ),
  );
  const reset = result.rows[0];

  if (
    !reset ||
    reset.used_at ||
    !reset.is_active ||
    new Date(reset.expires_at) < new Date()
  ) {
    throw new Error("Password reset link is invalid or expired.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await query(
    `UPDATE users
     SET password = $1, force_password_reset = false, updated_at = NOW()
     WHERE id = $2`,
    [hashedPassword, reset.user_id],
  );
  await revokeTrustedMfaDevices(reset.user_id);
  await runWithDbContext(
    { userId: reset.user_id, role: "system_admin", schoolId: null },
    () =>
      query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [
        reset.id,
      ]),
  );
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
     VALUES ($1, 'password_reset_completed', 'user', $1, $2)`,
    [reset.user_id, JSON.stringify({ via: "reset_link" })],
  );
  await sessionService.revokeAllSessions(reset.user_id, "password_reset");

  return { message: "Password updated successfully. You can now sign in." };
}

async function login(email, password, trustedDeviceToken) {
  const result = await query(
    "SELECT * FROM users WHERE (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)) AND is_active = true",
    [email],
  );
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid credentials");
  }

  if (await isMfaRequiredForUser(user)) {
    if (await isTrustedMfaDevice(user.id, trustedDeviceToken)) {
      return buildAuthResponse(user, { mfaTrustedDevice: true });
    }

    // Generate and send MFA code via email
    const mfaCode = generateMFACode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await query(
      `UPDATE users SET mfa_code = NULL, mfa_code_hash = $1, mfa_code_attempts = 0,
       mfa_code_created_at = NOW(), mfa_code_expires_at = $2 WHERE id = $3`,
      [hashMfaCode(mfaCode), expiresAt, user.id],
    );

    // Send MFA code via email
    await sendMFACode(user.email, mfaCode, user.full_name);

    const tempToken = jwt.sign(
      { userId: user.id, mfaPending: true },
      env.jwtSecret,
      { expiresIn: "5m" },
    );
    return { mfaRequired: true, tempToken };
  }

  return buildAuthResponse(user);
}

async function verify2FA(
  tempToken,
  code,
  rememberDevice,
  ipAddress,
  userAgent,
) {
  const decoded = jwt.verify(tempToken, env.jwtSecret);
  if (!decoded.mfaPending) {
    throw new Error("Invalid temporary token");
  }

  const result = await query(
    "SELECT * FROM users WHERE id = $1 AND is_active = true",
    [decoded.userId],
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.mfa_code_hash || new Date() > new Date(user.mfa_code_expires_at)) {
    throw new Error("MFA code has expired");
  }

  if (Number(user.mfa_code_attempts || 0) >= 5) {
    throw new Error("Too many MFA attempts. Request a new code.");
  }

  if (!safeHashEqual(user.mfa_code_hash, hashMfaCode(code))) {
    await query(
      `UPDATE users SET mfa_code_attempts = mfa_code_attempts + 1,
       mfa_code_hash = CASE WHEN mfa_code_attempts + 1 >= 5 THEN NULL ELSE mfa_code_hash END
       WHERE id = $1`,
      [user.id],
    );
    throw new Error("Invalid MFA code");
  }

  // Clear the MFA code after successful verification
  await query(
    `UPDATE users SET mfa_code = NULL, mfa_code_hash = NULL, mfa_code_attempts = 0,
     mfa_code_created_at = NULL, mfa_code_expires_at = NULL WHERE id = $1`,
    [user.id],
  );

  const trustedDevice = rememberDevice
    ? await createTrustedMfaDevice(user.id, ipAddress, userAgent)
    : {};

  return buildAuthResponse(user, trustedDevice);
}

async function getCurrentUser(userId) {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.full_name, u.school_id, u.username,
            u.force_password_reset, s.name AS school_name,
            s.logo_url AS school_logo_url
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     WHERE u.id = $1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user) {
    return user;
  }

  return {
    ...user,
    consentRequired: !(await privacyService.hasCurrentConsent(userId)),
  };
}

async function resetPassword(userId, oldPassword, newPassword) {
  const result = await query(
    "SELECT * FROM users WHERE id = $1 AND is_active = true",
    [userId],
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("User not found");
  }

  // Verify old password
  if (!(await bcrypt.compare(oldPassword, user.password))) {
    throw new Error("Incorrect old password");
  }

  validatePasswordPolicy(newPassword);

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear force_password_reset flag
  await query(
    "UPDATE users SET password = $1, force_password_reset = false, updated_at = NOW() WHERE id = $2",
    [hashedPassword, userId],
  );
  await revokeTrustedMfaDevices(userId);
  await sessionService.revokeAllSessions(userId, "password_changed");

  return { message: "Password reset successfully" };
}

async function resetPasswordByAdmin(userId, newPassword) {
  const result = await query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = result.rows[0];

  if (!user) {
    throw new Error("User not found");
  }

  validatePasswordPolicy(newPassword);

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and set force_password_reset flag
  await query(
    "UPDATE users SET password = $1, force_password_reset = true, updated_at = NOW() WHERE id = $2",
    [hashedPassword, userId],
  );
  await revokeTrustedMfaDevices(userId);
  await sessionService.revokeAllSessions(userId, "admin_password_reset");

  return {
    message: "Password reset successfully. User must change on next login.",
  };
}

function generateMFACode() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = {
  login,
  refreshSession,
  verify2FA,
  getCurrentUser,
  resetPassword,
  resetPasswordByAdmin,
  requestPasswordReset,
  confirmPasswordReset,
  sendPasswordResetLinkForUser,
  isDeliverableEmail,
  getMfaPolicy,
  updateMfaPolicy,
  generateMFACode,
  hashMfaCode,
  validatePasswordPolicy,
};
