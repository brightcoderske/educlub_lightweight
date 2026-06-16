const { query } = require("../config");

async function recordSecurityEvent({
  userId = null,
  action,
  entityType = "security",
  entityId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
}) {
  if (!action) return;
  try {
    await query(
      `INSERT INTO audit_logs (
         user_id, action, entity_type, entity_id, new_values, ip_address, user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        entityType,
        entityId,
        JSON.stringify(details || {}),
        ipAddress || null,
        userAgent || null,
      ],
    );
  } catch (error) {
    console.warn("Security audit event was not recorded:", error.message);
  }
}

module.exports = { recordSecurityEvent };
