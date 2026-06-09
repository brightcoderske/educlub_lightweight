const express = require("express");
const feedbackController = require("../controllers/feedback.controller");
const { authenticateToken, requireRole } = require("../middleware");

const router = express.Router();

router.get(
  "/learner/unread",
  authenticateToken,
  requireRole("learner"),
  feedbackController.learnerUnread,
);
router.get(
  "/learner/thread",
  authenticateToken,
  requireRole("learner"),
  feedbackController.learnerThread,
);
router.post(
  "/learner/messages",
  authenticateToken,
  requireRole("learner"),
  feedbackController.learnerMessage,
);
router.get(
  "/admin/threads",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  feedbackController.adminThreads,
);
router.get(
  "/admin/threads/:id",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  feedbackController.adminThread,
);
router.post(
  "/admin/threads/:id/messages",
  authenticateToken,
  requireRole("system_admin", "school_admin", "teacher"),
  feedbackController.adminReply,
);

module.exports = router;
