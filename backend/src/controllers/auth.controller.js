const authService = require("../services/auth.service");
const { recordSecurityEvent } = require("../services/securityAudit.service");

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
    res.json(result);
  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(401).json({ error: error.message });
  }
}

async function logout(req, res) {
  res.json({ message: "Logged out successfully" });
}

async function refreshSession(req, res) {
  try {
    res.json(await authService.refreshSession(req.user.userId));
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
  refreshSession,
  getCurrentUser,
  resetPassword,
  resetPasswordByAdmin,
  requestPasswordReset,
  confirmPasswordReset,
  getMfaPolicy,
  updateMfaPolicy,
};
