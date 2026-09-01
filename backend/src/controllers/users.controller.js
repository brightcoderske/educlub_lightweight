const { query } = require("../config");
const env = require("../config/env");
const authService = require("../services/auth.service");
const { generateRandomPassword, hashPassword } = require("../utils/password");
const { sendWelcomeEmail } = require("../utils/email");
const {
  resolveStaffAccountInput,
} = require("../services/staffAccounts.service");

async function getUsers(req, res) {
  try {
    const { role } = req.query;
    let queryText = `
      SELECT u.id, u.email, u.full_name, u.role, u.school_id, u.username,
             u.force_password_reset, u.is_active, s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (role) {
      queryText += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (req.user.role === "school_admin") {
      // A school admin with no school on the token must see nobody rather than
      // falling through to an unfiltered directory of every user.
      const schoolId = Number(req.user.schoolId);
      if (!Number.isInteger(schoolId) || schoolId <= 0) {
        return res.json([]);
      }
      queryText += ` AND u.school_id = $${paramIndex}::integer`;
      params.push(schoolId);
      paramIndex++;
      queryText += " AND u.role = 'teacher'";
    } else if (req.query.school_id) {
      queryText += ` AND u.school_id = $${paramIndex}`;
      params.push(req.query.school_id);
      paramIndex++;
    }

    queryText += " ORDER BY u.full_name";

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
}

async function createSchoolAdmin(req, res) {
  req.body.role = "school_admin";
  return createStaffAccount(req, res);
}

async function createStaffAccount(req, res) {
  try {
    const staff = resolveStaffAccountInput(req.user, req.body);
    const { phone, is_primary } = req.body;

    const password = env.defaultSchoolAdminPassword;
    const hashedPassword = await hashPassword(password);

    const userResult = await query(
      `INSERT INTO users (
         email,
         password,
         full_name,
         role,
         school_id,
         username,
         force_password_reset,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       RETURNING id, email, full_name, role, school_id, username, force_password_reset, is_active`,
      [
        staff.email,
        hashedPassword,
        staff.fullName,
        staff.role,
        staff.schoolId,
        staff.username,
      ],
    );

    const user = userResult.rows[0];

    if (staff.role === "school_admin") {
      await query(
        `INSERT INTO school_admins (user_id, school_id, is_primary)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, school_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        [user.id, staff.schoolId, Boolean(is_primary)],
      );
    }

    await sendWelcomeEmail(
      staff.email,
      staff.fullName,
      staff.username,
      password,
    );

    res.status(201).json({ ...user, phone });
  } catch (error) {
    console.error("Create staff account error:", error);
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "A user with this email already exists" });
    }
    const status = /required|teachers only|cannot create/i.test(error.message)
      ? 400
      : 500;
    res.status(status).json({ error: error.message || "Failed to create staff account" });
  }
}

async function resetUserPasswordByEmail(req, res) {
  try {
    const result = await query(
      `SELECT id, email, full_name, username, role, school_id
       FROM users
       WHERE id = $1 AND is_active = true`,
      [req.params.id],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      req.user.role === "school_admin" &&
      (Number(user.school_id) !== Number(req.user.schoolId) ||
        user.role === "system_admin")
    ) {
      return res.status(403).json({ error: "User is outside your school" });
    }

    if (authService.isDeliverableEmail(user.email)) {
      const result = await authService.sendPasswordResetLinkForUser(
        user,
        req.user.userId,
        req.ip,
        req.get("user-agent"),
      );
      return res.json(result);
    }

    if (user.role !== "learner") {
      return res.status(400).json({
        error: "This account does not have a reachable email address.",
      });
    }

    const password = generateRandomPassword(14);
    const hashedPassword = await hashPassword(password);

    await query(
      `UPDATE users
       SET password = $1, force_password_reset = true, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id],
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
       VALUES ($1, 'learner_temporary_password_issued', 'user', $1, $2, $3)`,
      [
        user.id,
        JSON.stringify({
          requestedBy: req.user.userId,
          reason: "no_deliverable_email",
        }),
        req.ip || null,
      ],
    );

    res.json({
      message:
        "Learner has no reachable email. A one-time temporary password was generated and must be changed at next sign-in.",
      temporaryPassword: password,
    });
  } catch (error) {
    console.error("Reset user password email error:", error);
    res.status(500).json({ error: "Failed to reset password by email" });
  }
}

async function updateUser(req, res) {
  try {
    const { full_name, email, username, school_id, is_active } = req.body;

    const existingResult = await query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const schoolAdminCanEdit =
      req.user.role === "school_admin" &&
      existing.role === "teacher" &&
      Number(existing.school_id) === Number(req.user.schoolId);
    if (
      (req.user.role !== "system_admin" && !schoolAdminCanEdit) ||
      !["school_admin", "teacher", "learner"].includes(existing.role)
    ) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const result = await query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           username = $3,
           school_id = $4,
           is_active = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, full_name, role, school_id, username, force_password_reset, is_active`,
      [
        full_name ?? existing.full_name,
        email ?? existing.email,
        username ?? existing.username,
        schoolAdminCanEdit
          ? existing.school_id
          : school_id ?? existing.school_id,
        is_active ?? existing.is_active,
        req.params.id,
      ],
    );

    if (existing.role === "school_admin") {
      await query(
        `INSERT INTO school_admins (user_id, school_id, is_primary)
         VALUES ($1, $2, true)
         ON CONFLICT (user_id, school_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        [req.params.id, school_id ?? existing.school_id],
      );
    }
    if (
      existing.role === "teacher" &&
      req.user.role === "system_admin" &&
      school_id &&
      Number(school_id) !== Number(existing.school_id)
    ) {
      await query(
        `UPDATE course_teacher_assignments
         SET is_active = false,
             deallocated_at = COALESCE(deallocated_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE teacher_user_id = $1 AND is_active = true`,
        [existing.id],
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update user error:", error);
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Email or username is already in use" });
    }
    res.status(500).json({ error: "Failed to update user" });
  }
}

async function deleteUser(req, res) {
  try {
    const existingResult = await query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user.role !== "system_admin" || existing.role === "system_admin") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    await query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
}

module.exports = {
  getUsers,
  createSchoolAdmin,
  createStaffAccount,
  resetUserPasswordByEmail,
  updateUser,
  deleteUser,
};
