const PDFDocument = require("pdfkit");
const { query } = require("../config");

const CERTIFICATE_SELECT = `
  SELECT c.*,
         l.full_name AS learner_name,
         l.email AS learner_email,
         l.user_id AS learner_user_id,
         l.school_id,
         s.name AS school_name,
         s.logo_url AS school_logo_url,
         cr.name AS course_name,
         cr.description AS course_description,
         cr.certificate_enabled,
         COALESCE(c.approved_at, c.created_at) AS issued_date
  FROM certificates c
  JOIN learners l ON c.learner_id = l.id
  JOIN schools s ON l.school_id = s.id
  JOIN courses cr ON c.course_id = cr.id
`;

function normalizeStatus(status, fallback = "pending") {
  return ["pending", "approved", "issued"].includes(status) ? status : fallback;
}

function normalizeCompletionStatus(status) {
  return ["completed", "pending", "approved", "issued"].includes(status)
    ? status
    : "completed";
}

function filenameForCertificate(certificate) {
  const safeCourse = String(certificate.course_name || "course")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `educlub-certificate-${safeCourse || certificate.id}-${
    certificate.id
  }.pdf`;
}

function isSchoolStaff(user = {}) {
  return ["school_admin", "teacher"].includes(user.role);
}

function assertCertificateAccess(certificate, user = {}, options = {}) {
  if (!certificate) {
    const error = new Error("Certificate not found.");
    error.status = 404;
    throw error;
  }

  if (user.role === "system_admin") return;

  if (
    isSchoolStaff(user) &&
    Number(certificate.school_id) === Number(user.schoolId)
  ) {
    return;
  }

  if (
    user.role === "learner" &&
    Number(certificate.learner_user_id) === Number(user.userId)
  ) {
    if (options.approvedOnly && certificate.status !== "approved") {
      const error = new Error("Certificate is waiting for school approval.");
      error.status = 403;
      throw error;
    }
    return;
  }

  const error = new Error("You cannot access this certificate.");
  error.status = 403;
  throw error;
}

async function getCertificateRow(id) {
  const result = await query(`${CERTIFICATE_SELECT} WHERE c.id = $1::integer`, [
    id,
  ]);
  return result.rows[0] || null;
}

async function getAllCertificates(filters = {}, user = {}) {
  const params = [];
  const where = ["1=1"];

  if (user.role === "learner") {
    params.push(user.userId);
    where.push(`l.user_id = $${params.length}::integer`);
    where.push("c.status = 'approved'");
  } else if (isSchoolStaff(user)) {
    params.push(user.schoolId);
    where.push(`l.school_id = $${params.length}::integer`);
  } else if (filters.school_id) {
    params.push(filters.school_id);
    where.push(`l.school_id = $${params.length}::integer`);
  }

  if (filters.course_id) {
    params.push(filters.course_id);
    where.push(`c.course_id = $${params.length}::integer`);
  }

  if (filters.learner_id) {
    params.push(filters.learner_id);
    where.push(`c.learner_id = $${params.length}::integer`);
  }

  const result = await query(
    `${CERTIFICATE_SELECT}
     WHERE ${where.join(" AND ")}
     ORDER BY c.created_at DESC`,
    params
  );
  return result.rows;
}

async function getCertificateById(id, user = {}) {
  const certificate = await getCertificateRow(id);
  assertCertificateAccess(certificate, user, {
    approvedOnly: user.role === "learner",
  });
  return {
    ...certificate,
    download_url: `/certificates/download/${certificate.id}`,
  };
}

async function upsertCertificate(certificateData = {}) {
  const learnerId = Number(certificateData.learner_id);
  const courseId = Number(certificateData.course_id);
  if (!learnerId || !courseId)
    throw new Error("Learner and course are required.");

  const term = certificateData.term || null;
  const academicYear = certificateData.academic_year || null;
  const completionStatus = normalizeCompletionStatus(
    certificateData.completion_status
  );
  const status = normalizeStatus(certificateData.status, "pending");

  const existing = await query(
    `SELECT id
     FROM certificates
     WHERE learner_id = $1::integer
       AND course_id = $2::integer
       AND COALESCE(term, '') = COALESCE($3::varchar, '')
       AND COALESCE(academic_year::text, '') = COALESCE($4::varchar, '')
     LIMIT 1`,
    [learnerId, courseId, term, academicYear ? String(academicYear) : null]
  );

  if (existing.rows[0]) {
    await query(
      `UPDATE certificates
       SET completion_status = CASE
             WHEN status IN ('approved', 'issued') THEN completion_status
             ELSE $2::varchar
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::integer`,
      [existing.rows[0].id, completionStatus]
    );
    return getCertificateRow(existing.rows[0].id);
  }

  const result = await query(
    `INSERT INTO certificates (
       learner_id, course_id, term, academic_year, completion_status, status, updated_at
     )
     VALUES ($1::integer, $2::integer, $3::varchar, $4::integer, $5::varchar, $6::varchar, CURRENT_TIMESTAMP)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [learnerId, courseId, term, academicYear, completionStatus, status]
  );

  if (result.rows[0]) return getCertificateRow(result.rows[0].id);

  const fallback = await query(
    `SELECT id
     FROM certificates
     WHERE learner_id = $1::integer
       AND course_id = $2::integer
       AND COALESCE(term, '') = COALESCE($3::varchar, '')
       AND COALESCE(academic_year::text, '') = COALESCE($4::varchar, '')
     LIMIT 1`,
    [learnerId, courseId, term, academicYear ? String(academicYear) : null]
  );
  return fallback.rows[0] ? getCertificateRow(fallback.rows[0].id) : null;
}

async function generateCertificate(certificateData = {}, user = {}) {
  const learner = await query(
    `SELECT l.*, c.school_id AS course_school_id
     FROM learners l
     JOIN courses c ON c.id = $2::integer
     WHERE l.id = $1::integer`,
    [certificateData.learner_id, certificateData.course_id]
  );
  const row = learner.rows[0];
  if (!row) throw new Error("Learner or course not found.");

  if (
    user.role !== "system_admin" &&
    (!isSchoolStaff(user) ||
      Number(row.school_id) !== Number(user.schoolId) ||
      Number(row.course_school_id) !== Number(user.schoolId))
  ) {
    const error = new Error("You cannot generate this certificate.");
    error.status = 403;
    throw error;
  }

  return upsertCertificate({ ...certificateData, status: "pending" });
}

async function ensureCourseCompletionCertificate({
  learnerId,
  courseId,
  term,
  academicYear,
} = {}) {
  const courseResult = await query(
    `SELECT id, certificate_enabled
     FROM courses
     WHERE id = $1::integer
     LIMIT 1`,
    [courseId]
  );
  const course = courseResult.rows[0];
  if (!course?.certificate_enabled) return null;

  return upsertCertificate({
    learner_id: learnerId,
    course_id: courseId,
    term,
    academic_year: academicYear,
    completion_status: "completed",
    status: "pending",
  });
}

async function approveCertificate(id, approvedBy, user = {}) {
  const certificate = await getCertificateRow(id);
  assertCertificateAccess(certificate, user);

  const result = await query(
    `UPDATE certificates
     SET status = 'approved',
         completion_status = 'approved',
         approved_by = $1::integer,
         approved_at = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2::integer
     RETURNING id`,
    [approvedBy, id]
  );

  if (!result.rows[0]) {
    const error = new Error("Certificate not found.");
    error.status = 404;
    throw error;
  }

  return getCertificateRow(id);
}

function drawCenteredText(doc, text, y, options = {}) {
  doc
    .font(options.font || "Helvetica")
    .fontSize(options.size || 18)
    .fillColor(options.color || "#24324b")
    .text(text, 60, y, {
      width: doc.page.width - 120,
      align: "center",
    });
}

function buildCertificatePdf(certificate) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 48,
      info: {
        Title: `EduClub Certificate - ${certificate.learner_name}`,
        Author: "EduClub",
      },
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { width, height } = doc.page;
    doc
      .rect(24, 24, width - 48, height - 48)
      .lineWidth(3)
      .stroke("#f59e0b");
    doc
      .rect(38, 38, width - 76, height - 76)
      .lineWidth(1)
      .stroke("#2563eb");

    drawCenteredText(doc, certificate.school_name || "EduClub", 68, {
      font: "Helvetica-Bold",
      size: 20,
      color: "#2563eb",
    });
    drawCenteredText(doc, "Certificate of Completion", 112, {
      font: "Helvetica-Bold",
      size: 34,
      color: "#111827",
    });
    drawCenteredText(doc, "This is proudly awarded to", 170, {
      size: 15,
      color: "#6b7280",
    });
    drawCenteredText(doc, certificate.learner_name || "Learner", 205, {
      font: "Helvetica-Bold",
      size: 32,
      color: "#0f766e",
    });
    drawCenteredText(doc, "for successfully completing", 268, {
      size: 15,
      color: "#6b7280",
    });
    drawCenteredText(doc, certificate.course_name || "Course", 300, {
      font: "Helvetica-Bold",
      size: 24,
      color: "#24324b",
    });

    const date = certificate.issued_date
      ? new Date(certificate.issued_date).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");
    const period = [certificate.term, certificate.academic_year]
      .filter(Boolean)
      .join(" | ");
    drawCenteredText(
      doc,
      `${period ? `${period} | ` : ""}Issued: ${date}`,
      360,
      {
        size: 13,
        color: "#6b7280",
      }
    );

    doc.moveTo(165, 430).lineTo(330, 430).stroke("#111827");
    doc
      .moveTo(width - 330, 430)
      .lineTo(width - 165, 430)
      .stroke("#111827");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text("School Approval", 165, 440, { width: 165, align: "center" })
      .text("EduClub", width - 330, 440, { width: 165, align: "center" });

    drawCenteredText(
      doc,
      `Certificate ID: CERT-${certificate.id}`,
      height - 82,
      {
        size: 9,
        color: "#6b7280",
      }
    );

    doc.end();
  });
}

async function downloadCertificatePdf(id, user = {}) {
  const certificate = await getCertificateRow(id);
  assertCertificateAccess(certificate, user, {
    approvedOnly: user.role === "learner",
  });
  return {
    filename: filenameForCertificate(certificate),
    buffer: await buildCertificatePdf(certificate),
  };
}

module.exports = {
  getAllCertificates,
  getCertificateById,
  generateCertificate,
  ensureCourseCompletionCertificate,
  approveCertificate,
  downloadCertificatePdf,
  assertCertificateAccess,
};
