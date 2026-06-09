const notificationsService = require("../services/notifications.service");

async function getNotifications(req, res) {
  try {
    const notifications = await notificationsService.getNotificationsForUser(
      req.user,
      Number(req.query.limit) || 20
    );
    res.json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
}

async function markNotificationRead(req, res) {
  try {
    const notification = await notificationsService.markAsRead(
      req.user,
      req.params.id
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
};
