const authService = require("../services/auth.service");
const { recordSecurityEvent } = require("../services/securityAudit.service");
const sessionService = require("../services/session.service");
const { runWithDbContext } = require("../config/db");

const REFRESH_COOKIE = "educlub_refresh";

function readCookie(req, name) {
  const item = String(req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function sessionContext(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent"), deviceName: req.body?.deviceName };
}

function setRefreshCookie(res, session) {
  res.cookie(REFRESH_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    expires: session.expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
}

async function login(req, res) {
  try {
    const { email, password, trustedDeviceToken } = req.body;
    const result = await authService.login(email, password, trustedDeviceToken);
    await recordSecurityEvent({
      userId: result.user?.id,
      action: "login_success",
      details: { role: result.user?.role },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    if (result.user) setRefreshCookie(res, await sessionService.createSession(result.user.id, sessionContext(req)));
    res.json(result);
  } catch (error) {
    console.error("Login error:", error);
    await recordSecurityEvent({
      action: "login_failed",
      details: { email: req.body?.email || "" },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.status(401).json({ error: "Invalid login details" });
  }
}

async function verify2FA(req, res) {
  try {
    const { tempToken, code, rememberDevice } = req.body;
    const result = await authService.verify2FA(
      tempToken,
      code,
      rememberDevice,
      req.ip,
      req.get("user-agent"),
    );
    setRefreshCookie(res, await sessionService.createSession(result.user.id, sessionContext(req)));
    res.json(result);
  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(401).json({ error: error.message });
  }
}

async function logout(req, res) {
  await sessionService.revokeSession(readCookie(req, REFRESH_COOKIE), req.user?.userId || null);
  clearRefreshCookie(res);
  res.json({ message: "Logged out successfully" });
}

async function logoutAll(req, res) {
  await sessionService.revokeAllSessions(req.user.userId, "logout_all");
  clearRefreshCookie(res);
  res.json({ message: "Logged out from all devices successfully" });
}

async function refreshSession(req, res) {
  try {
    const rotated = await sessionService.rotateSession(
      readCookie(req, REFRESH_COOKIE) || req.body?.refreshToken,
      sessionContext(req),
    );
    const result = await runWithDbContext(rotated.authContext, () => authService.refreshSession(rotated.userId));
    setRefreshCookie(res, rotated);
    res.json(result);
  } catch (error) {
    console.error("Refresh session error:", error);
    res.status(401).json({ error: error.message });
  }
}

async function getCurrentUser(req, res) {
  try {
    const user = await authService.getCurrentUser(req.user.userId);
    res.json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(401).json({ error: error.message });
  }
}

async function resetPassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await authService.resetPassword(
      req.user.userId,
      oldPassword,
      newPassword,
    );
    clearRefreshCookie(res);
    res.json(result);
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function resetPasswordByAdmin(req, res) {
  try {
    const { userId, newPassword } = req.body;
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "System admin access required" });
    }
    const result = await authService.resetPasswordByAdmin(userId, newPassword);
    res.json(result);
  } catch (error) {
    console.error("Reset password by admin error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(
      email,
      req.ip,
      req.get("user-agent"),
    );
    res.json(result);
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function confirmPasswordReset(req, res) {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.confirmPasswordReset(token, newPassword);
    res.json(result);
  } catch (error) {
    console.error("Confirm password reset error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function getMfaPolicy(req, res) {
  try {
    const policy = await authService.getMfaPolicy();
    res.json(policy);
  } catch (error) {
    console.error("Get MFA policy error:", error);
    res.status(500).json({ error: "Failed to load MFA policy" });
  }
}

async function updateMfaPolicy(req, res) {
  try {
    const policy = await authService.updateMfaPolicy(req.body, req.user.userId);
    res.json(policy);
  } catch (error) {
    console.error("Update MFA policy error:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  login,
  verify2FA,
  logout,
  logoutAll,
  refreshSession,
  getCurrentUser,
  resetPassword,
  resetPasswordByAdmin,
  requestPasswordReset,
  confirmPasswordReset,
  getMfaPolicy,
  updateMfaPolicy,
};
