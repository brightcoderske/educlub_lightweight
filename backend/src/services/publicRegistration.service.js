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
const independentLearnersService = require("./independentLearners.service");

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
  const registrationType =
    data.registration_type === "independent" || data.school_id === "independent"
      ? "independent"
      : "school";
  const schoolId =
    registrationType === "independent" ? null : Number(data.school_id);
  const email = cleanText(data.email).toLowerCase();
  const parentFullName = cleanText(data.parent_full_name);
  const parentPhone = cleanText(data.parent_phone);
  const parentEmail = cleanText(data.parent_email).toLowerCase();
  const password = String(data.password || "");
  const termId = data.term_id ? Number(data.term_id) : null;

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    throw new Error("Choose a grade between 1 and 12.");
  }
  if (
    registrationType !== "independent" &&
    (!Number.isInteger(schoolId) || schoolId <= 0)
  ) {
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
  if (termId !== null && (!Number.isInteger(termId) || termId <= 0)) {
    throw new Error("Choose a valid academic term.");
  }

  validatePasswordPolicy(password);

  return {
    firstName,
    secondName,
    thirdName,
    fullName,
    grade: String(grade),
    schoolId,
    registrationType,
    email,
    parentFullName,
    parentPhone,
    parentEmail: parentEmail || null,
    password,
    termId,
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

async function resolveRegistrationSchool(valid, client) {
  if (valid.registrationType === "independent") {
    return independentLearnersService.ensureIndependentSchool();
  }

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
  return school;
}

async function listPublicTerms() {
  const result = await query(
    `SELECT t.id,
            t.name,
            t.term_type,
            t.start_date,
            t.end_date,
            t.is_active,
            ay.year AS academic_year,
            CONCAT(ay.year, ' - ', t.name) AS term_label,
            (CURRENT_DATE BETWEEN t.start_date AND t.end_date) AS is_current
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     ORDER BY
       (CURRENT_DATE BETWEEN t.start_date AND t.end_date) DESC,
       t.is_active DESC,
       ay.year DESC,
       t.start_date DESC`,
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
  let committed = false;

  try {
    await client.query("BEGIN");

    const school = await resolveRegistrationSchool(valid, client);
    valid.schoolId = school.id;

    const termResult = valid.termId
      ? await client.query(
          `SELECT t.id, t.name, t.term_type, t.start_date, t.end_date, t.is_active,
                  ay.year AS academic_year
           FROM terms t
           JOIN academic_years ay ON ay.id = t.academic_year_id
           WHERE t.id = $1::integer
           LIMIT 1`,
          [valid.termId],
        )
      : await client.query(
          `SELECT t.id, t.name, t.term_type, t.start_date, t.end_date, t.is_active,
                  ay.year AS academic_year
           FROM terms t
           JOIN academic_years ay ON ay.id = t.academic_year_id
           WHERE t.term_type = 'regular'
             AND (
               CURRENT_DATE BETWEEN t.start_date AND t.end_date
               OR t.is_active = true
             )
           ORDER BY
             (CURRENT_DATE BETWEEN t.start_date AND t.end_date) DESC,
             t.is_active DESC,
             t.start_date DESC
           LIMIT 1`,
        );
    const term = termResult.rows[0];
    if (!term) {
      throw new Error("No academic term is available for learner registration.");
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
      `INSERT INTO learners (user_id, school_id, full_name, email, grade, term, academic_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user.id,
        valid.schoolId,
        valid.fullName,
        valid.email,
        valid.grade,
        term.name,
        term.academic_year,
      ],
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
        termId: term.id,
        term: term.name,
        academicYear: term.academic_year,
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
          term: term.name,
          academicYear: term.academic_year,
          parentConsent: true,
        }),
        ipAddress || null,
      ],
    );

    await client.query("COMMIT");
    committed = true;

    if (valid.registrationType === "independent") {
      try {
        await independentLearnersService.allocateIndependentPreviewCourses(
          learner,
          term,
        );
      } catch (allocationError) {
        console.error(
          "Independent learner preview allocation error:",
          allocationError,
        );
      }
    }

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
      term: term.name,
      academic_year: term.academic_year,
    };
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listPublicSchools,
  listPublicTerms,
  registerLearner,
};
