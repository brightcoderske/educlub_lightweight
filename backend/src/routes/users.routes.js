const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get(
  "/",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  usersController.getUsers,
);
router.post(
  "/staff",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  usersController.createStaffAccount,
);
router.post(
  "/school-admins",
  authenticateToken,
  isSystemAdmin,
  usersController.createSchoolAdmin
);
router.put(
  "/:id/reset-password-email",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  usersController.resetUserPasswordByEmail
);
router.put(
  "/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin"),
  usersController.updateUser,
);
router.delete("/:id", authenticateToken, isSystemAdmin, usersController.deleteUser);

module.exports = router;
