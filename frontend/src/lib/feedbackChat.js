// Shared by the learner's chat and the staff conversations panel.

// Who sent a message. A learner writes to their own school, so a reply comes
// from their teacher or school admin; only independent learners hear from eduClub.
const SENDER_LABELS = {
  learner: "Learner",
  teacher: "Teacher",
  school_admin: "School admin",
  system_admin: "eduClub",
};

export const STAFF_ROLES = ["system_admin", "school_admin", "teacher"];

export function senderLabel(role) {
  return SENDER_LABELS[role] || "";
}

export function formatMessageTime(value) {
  return value
    ? new Date(value).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

/** The chat's heading and opening line for this learner's conversation. */
export function learnerChatWording(thread) {
  if (!thread || thread.independent) {
    return {
      title: "Message eduClub",
      intro: "Ask eduClub for help or send feedback. Replies will appear here.",
    };
  }
  const school = String(thread.school_name || "").trim();
  return {
    title: school ? `Message ${school}` : "Message your school",
    intro: "Ask your teacher or school admin for help. Their replies will appear here.",
  };
}
