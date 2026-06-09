const { query } = require("../config");
const notificationsService = require("./notifications.service");

const adminReplyRoles = ["system_admin", "school_admin", "teacher"];

function cleanMessage(message) {
  return String(message || "").trim();
}

async function findLearner(userId) {
  const result = await query(
    "SELECT * FROM learners WHERE user_id = $1 AND is_active = true LIMIT 1",
    [userId],
  );
  return result.rows[0];
}

async function getOrCreateLearnerThread(user) {
  const learner = await findLearner(user.userId);
  const existing = await query(
    `SELECT ft.*,
            l.full_name AS learner_name,
            s.name AS school_name,
            (
              SELECT COUNT(*)::integer
              FROM feedback_messages fm
              WHERE fm.thread_id = ft.id
                AND fm.sender_role = ANY($2::text[])
                AND (
                  ft.learner_last_read_at IS NULL
                  OR fm.created_at > ft.learner_last_read_at
                )
            ) AS unread_replies
     FROM feedback_threads ft
     LEFT JOIN learners l ON l.id = ft.learner_id
     LEFT JOIN schools s ON s.id = ft.school_id
     WHERE ft.learner_user_id = $1
     ORDER BY ft.updated_at DESC
     LIMIT 1`,
    [user.userId, adminReplyRoles],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await query(
    `INSERT INTO feedback_threads (
       learner_user_id, learner_id, school_id, learner_last_read_at
     )
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [
      user.userId,
      learner?.id || null,
      learner?.school_id || user.schoolId || null,
    ],
  );

  return {
    ...created.rows[0],
    learner_name: learner?.full_name || user.username || "Learner",
    school_name: null,
    unread_replies: 0,
  };
}

async function getLearnerThread(user) {
  const thread = await getOrCreateLearnerThread(user);
  const messages = await query(
    `SELECT id, sender_role, message, created_at
     FROM feedback_messages
     WHERE thread_id = $1
     ORDER BY created_at ASC`,
    [thread.id],
  );

  await query(
    "UPDATE feedback_threads SET learner_last_read_at = NOW() WHERE id = $1",
    [thread.id],
  );

  return { thread, messages: messages.rows };
}

async function getLearnerUnread(user) {
  const result = await query(
    `SELECT ft.id AS thread_id,
            ft.updated_at,
            (
              SELECT COUNT(*)::integer
              FROM feedback_messages fm
              WHERE fm.thread_id = ft.id
                AND fm.sender_role = ANY($2::text[])
                AND (
                  ft.learner_last_read_at IS NULL
                  OR fm.created_at > ft.learner_last_read_at
                )
            ) AS unread_replies
     FROM feedback_threads ft
     WHERE ft.learner_user_id = $1
     ORDER BY ft.updated_at DESC
     LIMIT 1`,
    [user.userId, adminReplyRoles],
  );

  return (
    result.rows[0] || {
      thread_id: null,
      unread_replies: 0,
      updated_at: null,
    }
  );
}

async function addLearnerMessage(user, message) {
  const clean = cleanMessage(message);
  if (!clean) {
    throw new Error("Write a message before sending feedback.");
  }
  if (clean.length > 2000) {
    throw new Error("Feedback message must be 2000 characters or fewer.");
  }

  const thread = await getOrCreateLearnerThread(user);
  const result = await query(
    `INSERT INTO feedback_messages (thread_id, sender_user_id, sender_role, message)
     VALUES ($1, $2, 'learner', $3)
     RETURNING id, sender_role, message, created_at`,
    [thread.id, user.userId, clean],
  );
  await query(
    `UPDATE feedback_threads
     SET status = 'open', updated_at = NOW(), admin_last_read_at = NULL
     WHERE id = $1`,
    [thread.id],
  );
  await Promise.all([
    notificationsService.notifyRole("system_admin", {
      title: "Learner message",
      message: "A learner sent a new message.",
      notification_type: "learner_feedback",
      entity_type: "feedback_thread",
      entity_id: thread.id,
    }),
    thread.school_id
      ? notificationsService.notifyRole("school_admin", {
          school_id: thread.school_id,
          title: "Learner message",
          message: "A learner from your school sent a new message.",
          notification_type: "learner_feedback",
          entity_type: "feedback_thread",
          entity_id: thread.id,
        })
      : null,
  ].filter(Boolean));

  return result.rows[0];
}

function adminSchoolFilter(user, params) {
  if (user.role === "system_admin") {
    return "";
  }

  params.push(user.schoolId || null);
  return `WHERE ft.school_id = $${params.length}`;
}

async function listThreads(user) {
  const params = [];
  const where = adminSchoolFilter(user, params);
  const result = await query(
    `SELECT ft.*,
            l.full_name AS learner_name,
            l.email AS learner_email,
            s.name AS school_name,
            last_message.message AS last_message,
            last_message.created_at AS last_message_at,
            (
              SELECT COUNT(*)::integer
              FROM feedback_messages fm
              WHERE fm.thread_id = ft.id
                AND fm.sender_role = 'learner'
                AND (
                  ft.admin_last_read_at IS NULL
                  OR fm.created_at > ft.admin_last_read_at
                )
            ) AS unread_messages
     FROM feedback_threads ft
     LEFT JOIN learners l ON l.id = ft.learner_id
     LEFT JOIN schools s ON s.id = ft.school_id
     LEFT JOIN LATERAL (
       SELECT message, created_at
       FROM feedback_messages fm
       WHERE fm.thread_id = ft.id
       ORDER BY fm.created_at DESC
       LIMIT 1
     ) last_message ON true
     ${where}
     ORDER BY ft.updated_at DESC`,
    params,
  );
  return result.rows;
}

async function getThreadForAdmin(user, threadId) {
  const params = [threadId];
  const schoolFilter =
    user.role === "system_admin" ? "" : `AND ft.school_id = $${params.push(user.schoolId || null)}`;
  const threadResult = await query(
    `SELECT ft.*,
            l.full_name AS learner_name,
            l.email AS learner_email,
            s.name AS school_name
     FROM feedback_threads ft
     LEFT JOIN learners l ON l.id = ft.learner_id
     LEFT JOIN schools s ON s.id = ft.school_id
     WHERE ft.id = $1
       ${schoolFilter}`,
    params,
  );
  const thread = threadResult.rows[0];
  if (!thread) {
    throw new Error("Feedback thread not found.");
  }

  const messages = await query(
    `SELECT id, sender_role, message, created_at
     FROM feedback_messages
     WHERE thread_id = $1
     ORDER BY created_at ASC`,
    [threadId],
  );
  await query(
    "UPDATE feedback_threads SET admin_last_read_at = NOW() WHERE id = $1",
    [threadId],
  );

  return { thread, messages: messages.rows };
}

async function addAdminReply(user, threadId, message) {
  const clean = cleanMessage(message);
  if (!clean) {
    throw new Error("Write a reply before sending.");
  }
  if (clean.length > 2000) {
    throw new Error("Reply must be 2000 characters or fewer.");
  }

  const { thread } = await getThreadForAdmin(user, threadId);
  const result = await query(
    `INSERT INTO feedback_messages (thread_id, sender_user_id, sender_role, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_role, message, created_at`,
    [threadId, user.userId, user.role, clean],
  );
  await query(
    `UPDATE feedback_threads
     SET status = 'open', updated_at = NOW(), learner_last_read_at = NULL
     WHERE id = $1`,
    [threadId],
  );
  await notificationsService.notifyUser(thread.learner_user_id, {
    title: "New reply",
    message: "You have a new reply from eduClub.",
    notification_type: "learner_feedback_reply",
    entity_type: "feedback_thread",
    entity_id: thread.id,
  });

  return result.rows[0];
}

module.exports = {
  addAdminReply,
  addLearnerMessage,
  getLearnerThread,
  getLearnerUnread,
  getThreadForAdmin,
  listThreads,
};
