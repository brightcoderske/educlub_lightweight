const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { query } = require("../config");

const CERTIFICATE_COLORS = {
  navy: "#061a3a",
  navySoft: "#0a2a5c",
  gold: "#d4af37",
  goldLight: "#f5c451",
  ink: "#0b1633",
  muted: "#667085",
};

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
    if (options.approvedOnly && !["approved", "issued"].includes(certificate.status)) {
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
    where.push("c.status IN ('approved', 'issued')");
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

function getUploadLocalPath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  let uploadPath = fileUrl;
  try {
    if (/^https?:\/\//i.test(fileUrl)) {
      uploadPath = new URL(fileUrl).pathname;
    }
  } catch (error) {
    uploadPath = fileUrl;
  }
  if (!uploadPath.startsWith("/uploads/")) return null;
  return path.join(__dirname, "../..", uploadPath);
}

function drawCenteredText(doc, text, y, options = {}) {
  doc
    .font(options.font || "Helvetica")
    .fontSize(options.size || 18)
    .fillColor(options.color || CERTIFICATE_COLORS.ink)
    .text(String(text || ""), options.x || 60, y, {
      width: options.width || doc.page.width - 120,
      align: "center",
      characterSpacing: options.characterSpacing || 0,
    });
}

function drawSchoolMark(doc, certificate, x, y) {
  const localLogo = getUploadLocalPath(certificate.school_logo_url);
  if (localLogo && fs.existsSync(localLogo)) {
    doc.image(localLogo, x, y, { width: 54, height: 54, fit: [54, 54] });
  } else {
    doc
      .roundedRect(x, y, 54, 60, 6)
      .fill(CERTIFICATE_COLORS.navy)
      .strokeColor(CERTIFICATE_COLORS.gold)
      .lineWidth(2)
      .stroke();
    doc
      .fillColor(CERTIFICATE_COLORS.goldLight)
      .font("Helvetica-Bold")
      .fontSize(24)
      .text(
        (certificate.school_name || "S").slice(0, 1).toUpperCase(),
        x,
        y + 17,
        {
          width: 54,
          align: "center",
        }
      );
  }

  doc
    .fillColor(CERTIFICATE_COLORS.navy)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(
      String(certificate.school_name || "Your School").toUpperCase(),
      x + 68,
      y + 10,
      {
        width: 190,
        align: "left",
      }
    );
  doc
    .fillColor(CERTIFICATE_COLORS.gold)
    .font("Helvetica")
    .fontSize(7.5)
    .text("LEARN - LEAD - INSPIRE", x + 70, y + 48, {
      width: 180,
      align: "left",
      characterSpacing: 1.4,
    });
}

function drawEduClubBrand(doc, x, y) {
  doc
    .strokeColor(CERTIFICATE_COLORS.navy)
    .lineWidth(3)
    .moveTo(x, y + 46)
    .quadraticCurveTo(x + 20, y + 20, x + 42, y + 46)
    .moveTo(x + 48, y + 46)
    .quadraticCurveTo(x + 70, y + 20, x + 92, y + 46)
    .stroke();
  doc
    .strokeColor(CERTIFICATE_COLORS.gold)
    .lineWidth(5)
    .moveTo(x + 46, y + 50)
    .lineTo(x + 46, y + 20)
    .stroke();
  doc.circle(x + 46, y + 12, 5).fill(CERTIFICATE_COLORS.gold);
  doc
    .fillColor(CERTIFICATE_COLORS.navy)
    .font("Helvetica-Bold")
    .fontSize(27)
    .text("educlub", x + 108, y + 21, { width: 150 });
  doc
    .fillColor(CERTIFICATE_COLORS.gold)
    .font("Helvetica")
    .fontSize(7.5)
    .text("LEARN. SHARE. GROW.", x + 111, y + 55, {
      width: 150,
      characterSpacing: 2,
    });
}

function drawSeal(doc, x, y, radius, label = "EduClub Excellence") {
  doc.circle(x, y, radius + 8).fill(CERTIFICATE_COLORS.goldLight);
  doc.circle(x, y, radius + 3).fill(CERTIFICATE_COLORS.gold);
  doc.circle(x, y, radius).fill(CERTIFICATE_COLORS.navy);
  doc
    .circle(x, y, radius - 7)
    .strokeColor(CERTIFICATE_COLORS.goldLight)
    .lineWidth(1.2)
    .stroke();
  const sealLines = String(label || "")
    .toUpperCase()
    .replace("EDUCLUB EXCELLENCE", "EDUCLUB\nEXCELLENCE")
    .replace("TOGETHER WE GROW", "TOGETHER\nWE\nGROW");
  doc
    .fillColor(CERTIFICATE_COLORS.goldLight)
    .font("Helvetica-Bold")
    .fontSize(radius > 40 ? 10 : 9)
    .text(sealLines, x - radius + 8, y - 13, {
      width: radius * 2 - 16,
      align: "center",
      lineGap: 1,
    });
  doc
    .fontSize(18)
    .text("*", x - 8, y - radius + 9, { width: 16, align: "center" });
}

function drawPremiumRibbon(doc, width, height) {
  doc.save();
  doc
    .moveTo(0, 0)
    .lineTo(178, 0)
    .quadraticCurveTo(112, 96, 0, 178)
    .lineTo(0, 0)
    .fill(CERTIFICATE_COLORS.navy);
  doc
    .moveTo(0, height)
    .lineTo(0, height - 176)
    .quadraticCurveTo(122, height - 58, 268, height)
    .lineTo(0, height)
    .fill(CERTIFICATE_COLORS.navy);
  doc
    .strokeColor(CERTIFICATE_COLORS.goldLight)
    .lineWidth(10)
    .moveTo(140, 0)
    .quadraticCurveTo(78, 82, 0, 138)
    .stroke();
  doc
    .strokeColor(CERTIFICATE_COLORS.gold)
    .lineWidth(7)
    .moveTo(0, height - 115)
    .quadraticCurveTo(120, height - 35, 320, height - 28)
    .stroke();
  doc
    .moveTo(width - 170, 0)
    .lineTo(width - 64, 0)
    .lineTo(width, 62)
    .lineTo(width, 110)
    .lineTo(width - 170, 0)
    .fill(CERTIFICATE_COLORS.goldLight);
  doc
    .moveTo(width - 112, 0)
    .lineTo(width - 28, 0)
    .lineTo(width, 28)
    .lineTo(width, 78)
    .lineTo(width - 112, 0)
    .fill(CERTIFICATE_COLORS.gold);
  doc
    .moveTo(width - 122, 92)
    .lineTo(width - 62, 92)
    .lineTo(width - 62, 174)
    .lineTo(width - 92, 150)
    .lineTo(width - 122, 174)
    .lineTo(width - 122, 92)
    .fill(CERTIFICATE_COLORS.gold);
  doc.restore();
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
    doc.rect(0, 0, width, height).fill("#ffffff");
    drawPremiumRibbon(doc, width, height);
    doc
      .rect(14, 14, width - 28, height - 28)
      .lineWidth(1.2)
      .stroke(CERTIFICATE_COLORS.gold);
    doc
      .rect(44, 44, width - 88, height - 88)
      .lineWidth(0.8)
      .stroke(CERTIFICATE_COLORS.goldLight);

    drawSchoolMark(doc, certificate, 205, 70);
    doc
      .strokeColor("#98a2b3")
      .lineWidth(0.8)
      .moveTo(418, 73)
      .lineTo(418, 128)
      .stroke();
    drawEduClubBrand(doc, 458, 70);
    drawSeal(doc, width - 92, 88, 45, "EduClub Excellence");

    drawCenteredText(doc, "CERTIFICATE", 164, {
      font: "Helvetica-Bold",
      size: 44,
      color: CERTIFICATE_COLORS.navy,
      characterSpacing: 5,
    });
    doc
      .strokeColor(CERTIFICATE_COLORS.gold)
      .lineWidth(1.1)
      .moveTo(250, 236)
      .lineTo(318, 236)
      .moveTo(width - 318, 236)
      .lineTo(width - 250, 236)
      .stroke();
    drawCenteredText(doc, "OF COMPLETION", 214, {
      font: "Helvetica",
      size: 18,
      color: CERTIFICATE_COLORS.gold,
      characterSpacing: 5,
    });
    drawCenteredText(doc, "THIS CERTIFICATE IS PROUDLY PRESENTED TO", 262, {
      font: "Helvetica",
      size: 12,
      color: CERTIFICATE_COLORS.navy,
      characterSpacing: 1.2,
    });
    drawCenteredText(doc, certificate.learner_name || "Learner", 288, {
      font: "Times-Italic",
      size: 40,
      color: CERTIFICATE_COLORS.navy,
    });
    doc
      .strokeColor(CERTIFICATE_COLORS.gold)
      .lineWidth(0.9)
      .moveTo(220, 336)
      .lineTo(width - 220, 336)
      .stroke();
    drawCenteredText(doc, "for successfully completing", 358, {
      font: "Helvetica",
      size: 12,
      color: CERTIFICATE_COLORS.muted,
    });
    drawCenteredText(doc, certificate.course_name || "Course", 386, {
      font: "Helvetica-Bold",
      size: 22,
      color: CERTIFICATE_COLORS.ink,
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
      423,
      {
        size: 10.5,
        color: CERTIFICATE_COLORS.muted,
      }
    );

    doc.moveTo(162, 486).lineTo(316, 486).stroke(CERTIFICATE_COLORS.ink);
    doc
      .moveTo(width - 316, 486)
      .lineTo(width - 162, 486)
      .stroke(CERTIFICATE_COLORS.ink);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(CERTIFICATE_COLORS.ink)
      .text("School Approval", 158, 496, { width: 165, align: "center" })
      .text("EduClub", width - 324, 496, { width: 165, align: "center" });
    doc
      .fontSize(8)
      .fillColor(CERTIFICATE_COLORS.muted)
      .text(certificate.school_name || "School", 158, 511, {
        width: 165,
        align: "center",
      })
      .text("Learn. Share. Grow.", width - 324, 511, {
        width: 165,
        align: "center",
      });

    drawSeal(doc, width / 2, 490, 34, "Together We Grow");

    drawCenteredText(
      doc,
      `Certificate ID: CERT-${certificate.id}`,
      height - 44,
      {
        size: 9,
        color: CERTIFICATE_COLORS.muted,
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
