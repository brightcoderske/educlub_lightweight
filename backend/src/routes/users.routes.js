const express = require("express");
const router = express.Router();
const usersController = require("../controllers/users.controller");
const {
  authenticateToken,
  isSystemAdmin,
  requireRole,
} = require("../middleware");

router.get("/", authenticateToken, isSystemAdmin, usersController.getUsers);
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
router.put("/:id", authenticateToken, isSystemAdmin, usersController.updateUser);
router.delete("/:id", authenticateToken, isSystemAdmin, usersController.deleteUser);

module.exports = router;
