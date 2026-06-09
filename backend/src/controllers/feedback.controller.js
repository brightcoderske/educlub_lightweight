const feedbackService = require("../services/feedback.service");

function canManageFeedback(user) {
  return ["system_admin", "school_admin", "teacher"].includes(user.role);
}

async function learnerThread(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }
    res.json(await feedbackService.getLearnerThread(req.user));
  } catch (error) {
    console.error("Learner feedback thread error:", error);
    res.status(500).json({ error: "Failed to load feedback" });
  }
}

async function learnerMessage(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }
    res
      .status(201)
      .json(
        await feedbackService.addLearnerMessage(req.user, req.body.message),
      );
  } catch (error) {
    console.error("Learner feedback message error:", error);
    res.status(400).json({ error: error.message });
  }
}

async function learnerUnread(req, res) {
  try {
    if (req.user.role !== "learner") {
      return res.status(403).json({ error: "Learner access required" });
    }
    res.json(await feedbackService.getLearnerUnread(req.user));
  } catch (error) {
    console.error("Learner feedback unread error:", error);
    res.status(500).json({ error: "Failed to load feedback unread count" });
  }
}

async function adminThreads(req, res) {
  try {
    if (!canManageFeedback(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    res.json(await feedbackService.listThreads(req.user));
  } catch (error) {
    console.error("Admin feedback threads error:", error);
    res.status(500).json({ error: "Failed to load feedback threads" });
  }
}

async function adminThread(req, res) {
  try {
    if (!canManageFeedback(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    res.json(await feedbackService.getThreadForAdmin(req.user, req.params.id));
  } catch (error) {
    console.error("Admin feedback thread error:", error);
    res.status(404).json({ error: error.message });
  }
}

async function adminReply(req, res) {
  try {
    if (!canManageFeedback(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    res
      .status(201)
      .json(
        await feedbackService.addAdminReply(
          req.user,
          req.params.id,
          req.body.message,
        ),
      );
  } catch (error) {
    console.error("Admin feedback reply error:", error);
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  adminReply,
  adminThread,
  adminThreads,
  learnerMessage,
  learnerThread,
  learnerUnread,
};
