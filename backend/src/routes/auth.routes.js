const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateToken, requireRole } = require("../middleware");

router.post("/login", authController.login);
router.post("/2fa/verify", authController.verify2FA);
router.post("/password-reset/request", authController.requestPasswordReset);
router.post("/password-reset/confirm", authController.confirmPasswordReset);
router.post("/logout", authenticateToken, authController.logout);
router.get("/me", authenticateToken, authController.getCurrentUser);
router.get(
  "/mfa-policy",
  authenticateToken,
  requireRole("system_admin"),
  authController.getMfaPolicy
);
router.put(
  "/mfa-policy",
  authenticateToken,
  requireRole("system_admin"),
  authController.updateMfaPolicy
);
router.post("/reset-password", authenticateToken, authController.resetPassword);
router.post(
  "/reset-password/admin",
  authenticateToken,
  requireRole("system_admin"),
  authController.resetPasswordByAdmin
);

module.exports = router;
