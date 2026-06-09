const { query } = require("../config");

async function createNotification({
  user_id,
  role,
  school_id,
  title,
  message,
  notification_type,
  entity_type,
  entity_id,
}) {
  const result = await query(
    `INSERT INTO notifications (
       user_id, role, school_id, title, message, notification_type, entity_type, entity_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      user_id || null,
      role || null,
      school_id || null,
      title,
      message,
      notification_type || "info",
      entity_type || null,
      entity_id || null,
    ]
  );
  return result.rows[0];
}

async function notifyRole(role, notification) {
  return createNotification({ ...notification, role });
}

async function notifyUser(userId, notification) {
  return createNotification({ ...notification, user_id: userId });
}

async function getNotificationsForUser(user, limit = 20) {
  const result = await query(
    `SELECT *
     FROM notifications
     WHERE user_id = $1
        OR (
          role = $2
          AND (
            ($2 = 'system_admin' AND school_id IS NULL)
            OR (
              $2 IN ('school_admin', 'teacher')
              AND school_id = $3
            )
            OR (
              $2 = 'learner'
              AND school_id = $3
            )
          )
        )
        OR (
          role IN ('school_admin', 'teacher')
          AND $2 IN ('school_admin', 'teacher')
          AND school_id = $3
        )
     ORDER BY created_at DESC
     LIMIT $4`,
    [user.userId, user.role, user.schoolId || null, limit]
  );
  return result.rows;
}

async function markAsRead(user, notificationId) {
  const result = await query(
    `UPDATE notifications
     SET is_read = true
     WHERE id = $1
       AND (
         user_id = $2
         OR (
           role = $3
           AND (
             ($3 = 'system_admin' AND school_id IS NULL)
             OR (
               $3 IN ('school_admin', 'teacher')
               AND school_id = $4
             )
             OR (
               $3 = 'learner'
               AND school_id = $4
             )
           )
         )
         OR (
           role IN ('school_admin', 'teacher')
           AND $3 IN ('school_admin', 'teacher')
           AND school_id = $4
         )
       )
     RETURNING *`,
    [notificationId, user.userId, user.role, user.schoolId || null]
  );
  return result.rows[0];
}

module.exports = {
  createNotification,
  notifyRole,
  notifyUser,
  getNotificationsForUser,
  markAsRead,
};
