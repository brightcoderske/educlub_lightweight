const { query } = require("../config");
const notificationsService = require("./notifications.service");

const adminReplyRoles = ["system_admin", "school_admin", "teacher"];

// Who a learner's reply came from, in the words the learner sees.
const REPLY_FROM = {
  teacher: "your teacher",
  school_admin: "your school",
  system_admin: "eduClub",
};

function cleanMessage(message) {
  return String(message || "").trim();
}

// A learner talks to their own school: its admin and the teachers of their
// courses. Only learners of the independent-learners school, which has no
// staff of its own, talk to eduClub's system admins.
const INDEPENDENT_THREAD = `(ft.school_id IS NULL OR EXISTS (
  SELECT 1 FROM schools si WHERE si.id = ft.school_id AND si.is_independent_school = true
))`;

// The conversations a member of staff may read and answer, as a condition on ft.
function staffThreadScope(user, params) {
  if (user.role === "system_admin") return INDEPENDENT_THREAD;

  params.push(user.schoolId || null);
  let scope = `ft.school_id = $${params.length} AND NOT ${INDEPENDENT_THREAD}`;
  if (user.role === "teacher") {
    params.push(user.userId);
    scope += ` AND EXISTS (
      SELECT 1
      FROM course_allocations ca
      JOIN course_teacher_assignments cta ON cta.course_id = ca.course_id
      WHERE ca.learner_id = ft.learner_id
        AND cta.teacher_user_id = $${params.length}
        AND cta.is_active = true
    )`;
  }
  return scope;
}

async function notifyStaffOfLearnerMessage(thread) {
  const notification = {
    title: "Learner message",
    notification_type: "learner_feedback",
    entity_type: "feedback_thread",
    entity_id: thread.id,
  };
  if (thread.independent) {
    await notificationsService.notifyRole("system_admin", {
      ...notification,
      message: "An independent learner sent a new message.",
    });
    return;
  }
  if (!thread.school_id) return;

  // Only teachers of the learner's own school: they are the ones who can open it.
  const teachers = await query(
    `SELECT DISTINCT cta.teacher_user_id
     FROM course_allocations ca
     JOIN course_teacher_assignments cta ON cta.course_id = ca.course_id
     JOIN users teacher ON teacher.id = cta.teacher_user_id
     WHERE ca.learner_id = $1 AND cta.is_active = true AND teacher.school_id = $2`,
    [thread.learner_id, thread.school_id],
  );
  await Promise.all([
    notificationsService.notifyRole("school_admin", {
      ...notification,
      school_id: thread.school_id,
      message: "A learner from your school sent a new message.",
    }),
    ...teachers.rows.map((row) =>
      notificationsService.notifyUser(row.teacher_user_id, {
        ...notification,
        message: "A learner on your course sent a new message.",
      }),
    ),
  ]);
}

async function findLearner(userId) {
  const result = await query(
    "SELECT * FROM learners WHERE user_id = $1 AND is_active = true LIMIT 1",
    [userId],
  );
  return result.rows[0];
}

async function findLearnerThread(userId) {
  const existing = await query(
    `SELECT ft.*,
            l.full_name AS learner_name,
            s.name AS school_name,
            ${INDEPENDENT_THREAD} AS independent,
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
    [userId, adminReplyRoles],
  );
  const thread = existing.rows[0];
  return thread ? { ...thread, independent: Boolean(Number(thread.independent)) } : null;
}

async function getOrCreateLearnerThread(user) {
  const existing = await findLearnerThread(user.userId);
  if (existing) return existing;

  const learner = await findLearner(user.userId);
  await query(
    `INSERT INTO feedback_threads (
       learner_user_id, learner_id, school_id, learner_last_read_at
     )
     VALUES ($1, $2, $3, NOW())`,
    [
      user.userId,
      learner?.id || null,
      learner?.school_id || user.schoolId || null,
    ],
  );
  return findLearnerThread(user.userId);
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
  await notifyStaffOfLearnerMessage(thread);

  return result.rows[0];
}

async function listThreads(user) {
  const params = [];
  const where = `WHERE ${staffThreadScope(user, params)}`;
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
     LEFT JOIN feedback_messages last_message ON last_message.id = (
       SELECT fm.id
       FROM feedback_messages fm
       WHERE fm.thread_id = ft.id
       ORDER BY fm.created_at DESC, fm.id DESC
       LIMIT 1
     )
     ${where}
     ORDER BY ft.updated_at DESC`,
    params,
  );
  return result.rows;
}

async function getThreadForAdmin(user, threadId) {
  const params = [threadId];
  const schoolFilter = `AND ${staffThreadScope(user, params)}`;
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
    message: `You have a new reply from ${REPLY_FROM[user.role] || "eduClub"}.`,
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
