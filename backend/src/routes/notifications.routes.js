const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notifications.controller");
const { authenticateToken } = require("../middleware");

router.get("/", authenticateToken, notificationsController.getNotifications);
router.put(
  "/:id/read",
  authenticateToken,
  notificationsController.markNotificationRead
);

module.exports = router;
