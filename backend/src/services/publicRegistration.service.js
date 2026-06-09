const { pool, query } = require("../config");
const env = require("../config/env");
const privacyPolicy = require("../config/privacyPolicy");
const { hashPassword } = require("../utils/password");
const {
  sendLearnerRegistrationAdminEmail,
  sendLearnerRegistrationWelcomeEmail,
} = require("../utils/email");
const { validatePasswordPolicy } = require("./auth.service");
const learnersService = require("./learners.service");

function cleanText(value) {
  return String(value || "").trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^[+0-9][0-9\s().-]{6,24}$/.test(phone);
}

function buildFullName(firstName, secondName, thirdName) {
  const parts = [firstName, secondName, thirdName]
    .map(cleanText)
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error("Enter at least two learner names.");
  }

  return parts.join(" ");
}

function validateRegistration(data) {
  const firstName = cleanText(data.first_name);
  const secondName = cleanText(data.second_name);
  const thirdName = cleanText(data.third_name);
  const fullName = buildFullName(firstName, secondName, thirdName);
  const grade = Number(data.grade);
  const schoolId = Number(data.school_id);
  const email = cleanText(data.email).toLowerCase();
  const parentFullName = cleanText(data.parent_full_name);
  const parentPhone = cleanText(data.parent_phone);
  const parentEmail = cleanText(data.parent_email).toLowerCase();
  const password = String(data.password || "");

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    throw new Error("Choose a grade between 1 and 12.");
  }
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new Error("Choose a registered school.");
  }
  if (!validateEmail(email)) {
    throw new Error("Enter a valid learner email address.");
  }
  if (!parentFullName || parentFullName.split(/\s+/).length < 2) {
    throw new Error("Enter the parent or guardian full name.");
  }
  if (!validatePhone(parentPhone)) {
    throw new Error("Enter a valid parent or guardian phone number.");
  }
  if (parentEmail && !validateEmail(parentEmail)) {
    throw new Error("Enter a valid parent or guardian email address.");
  }
  if (!data.parent_consent) {
    throw new Error("Parent or guardian consent is required.");
  }

  validatePasswordPolicy(password);

  return {
    firstName,
    secondName,
    thirdName,
    fullName,
    grade: String(grade),
    schoolId,
    email,
    parentFullName,
    parentPhone,
    parentEmail: parentEmail || null,
    password,
    consentCompetitionUpdates: Boolean(data.consent_competition_updates),
    consentOpenCourseUpdates: Boolean(data.consent_open_course_updates),
  };
}

async function listPublicSchools() {
  const result = await query(
    `SELECT id, name, code
     FROM schools
     WHERE is_active = true
       AND allow_self_registration = true
     ORDER BY name`,
  );

  return result.rows;
}

async function notifySystemAdmins(registration) {
  const adminResult = await query(
    `SELECT email
     FROM users
     WHERE role = 'system_admin'
       AND is_active = true
       AND email IS NOT NULL`,
  );
  const recipients = [
    ...new Set(
      [env.systemAdminEmail, ...adminResult.rows.map((admin) => admin.email)]
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    ),
  ];

  await Promise.all(
    recipients.map((to) =>
      sendLearnerRegistrationAdminEmail({
        to,
        ...registration,
      }),
    ),
  );
}

async function registerLearner(data, ipAddress, userAgent) {
  const valid = validateRegistration(data);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const schoolResult = await client.query(
      `SELECT id, name
       FROM schools
       WHERE id = $1
         AND is_active = true
         AND allow_self_registration = true`,
      [valid.schoolId],
    );
    const school = schoolResult.rows[0];
    if (!school) {
      throw new Error("This school is not accepting self-registration right now.");
    }

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [valid.email],
    );
    if (existing.rows.length > 0) {
      throw new Error("An account already exists for this email address.");
    }

    const username = await learnersService.generateUniqueUsername(
      valid.fullName,
    );
    const passwordHash = await hashPassword(valid.password);
    const userResult = await client.query(
      `INSERT INTO users (
         email, password, full_name, role, school_id, username,
         force_password_reset, is_active
       )
       VALUES ($1, $2, $3, 'learner', $4, $5, false, true)
       RETURNING id, email, full_name, role, school_id, username, force_password_reset`,
      [valid.email, passwordHash, valid.fullName, valid.schoolId, username],
    );
    const user = userResult.rows[0];

    const learnerResult = await client.query(
      `INSERT INTO learners (user_id, school_id, full_name, email, grade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.id, valid.schoolId, valid.fullName, valid.email, valid.grade],
    );
    const learner = learnerResult.rows[0];

    const consentText = {
      policy: privacyPolicy,
      registration: {
        learnerName: valid.fullName,
        learnerEmail: valid.email,
        schoolId: valid.schoolId,
        schoolName: school.name,
        grade: valid.grade,
        parentFullName: valid.parentFullName,
        parentPhone: valid.parentPhone,
        parentEmail: valid.parentEmail,
        consentCompetitionUpdates: valid.consentCompetitionUpdates,
        consentOpenCourseUpdates: valid.consentOpenCourseUpdates,
        parentConsent: true,
      },
    };

    await client.query(
      `INSERT INTO user_consents (
         user_id, policy_version, policy_title, ip_address, user_agent, consent_text
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        privacyPolicy.version,
        privacyPolicy.title,
        ipAddress || null,
        userAgent || null,
        JSON.stringify(consentText),
      ],
    );
    await client.query(
      `INSERT INTO learner_parent_consents (
         learner_id, user_id, parent_full_name, parent_phone, parent_email,
         consent_competition_updates, consent_open_course_updates,
         consent_text, ip_address, user_agent
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        learner.id,
        user.id,
        valid.parentFullName,
        valid.parentPhone,
        valid.parentEmail,
        valid.consentCompetitionUpdates,
        valid.consentOpenCourseUpdates,
        JSON.stringify(consentText),
        ipAddress || null,
        userAgent || null,
      ],
    );
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
       VALUES ($1, 'learner_self_registered', 'learner', $2, $3, $4)`,
      [
        user.id,
        learner.id,
        JSON.stringify({
          schoolId: valid.schoolId,
          grade: valid.grade,
          parentConsent: true,
        }),
        ipAddress || null,
      ],
    );

    await client.query("COMMIT");

    const registration = {
      learnerName: valid.fullName,
      learnerEmail: valid.email,
      schoolName: school.name,
      grade: valid.grade,
      parentName: valid.parentFullName,
      parentPhone: valid.parentPhone,
    };

    await Promise.all([
      sendLearnerRegistrationWelcomeEmail({
        email: valid.email,
        learnerName: valid.fullName,
        parentName: valid.parentFullName,
      }),
      notifySystemAdmins(registration),
    ]);

    return {
      message: "Registration complete. Welcome to eduClub.",
      email: user.email,
      username: user.username,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listPublicSchools,
  registerLearner,
};
