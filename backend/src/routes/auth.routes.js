const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticateToken, requireRole } = require("../middleware");
const { validate } = require("../middleware/validation.middleware");
const authValidation = require("../validation/auth.validation");

router.post("/login", validate({ body: authValidation.login }), authController.login);
router.post("/2fa/verify", validate({ body: authValidation.verifyMfa }), authController.verify2FA);
router.post("/password-reset/request", validate({ body: authValidation.passwordResetRequest }), authController.requestPasswordReset);
router.post("/password-reset/confirm", validate({ body: authValidation.passwordResetConfirm }), authController.confirmPasswordReset);
router.post("/logout", authController.logout);
router.post("/logout-all", authenticateToken, authController.logoutAll);
router.post("/refresh", validate({ body: authValidation.refresh }), authController.refreshSession);
router.get("/me", authenticateToken, authController.getCurrentUser);
router.put("/profile-photo", authenticateToken, requireRole("learner"), authController.updateProfilePhoto);
router.get(
  "/mfa-policy",
  authenticateToken,
  requireRole("system_admin"),
  authController.getMfaPolicy,
);
router.put(
  "/mfa-policy",
  authenticateToken,
  requireRole("system_admin"),
  validate({ body: authValidation.mfaPolicy }),
  authController.updateMfaPolicy,
);
router.post("/reset-password", authenticateToken, validate({ body: authValidation.passwordChange }), authController.resetPassword);
router.post(
  "/reset-password/admin",
  authenticateToken,
  requireRole("system_admin"),
  validate({ body: authValidation.adminPasswordReset }),
  authController.resetPasswordByAdmin,
);

module.exports = router;
