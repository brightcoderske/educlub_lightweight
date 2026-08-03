const { query } = require("../config");
const env = require("../config/env");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function generateUsernameFromName(fullName) {
  // Remove special characters and spaces, convert to lowercase
  const cleaned = fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "");

  // Take first 8 characters
  const baseUsername = cleaned.substring(0, 8);

  return baseUsername;
}

async function isUsernameUnique(username, queryExecutor = query) {
  const result = await queryExecutor("SELECT id FROM users WHERE username = $1", [
    username,
  ]);
  return result.rows.length === 0;
}

async function generateUniqueUsername(fullName, queryExecutor = query) {
  let baseUsername = generateUsernameFromName(fullName);
  let username = baseUsername;
  let counter = 1;

  while (!(await isUsernameUnique(username, queryExecutor))) {
    username = `${baseUsername}${counter}`;
    counter++;

    // Safety check to prevent infinite loop
    if (counter > 1000) {
      throw new Error("Unable to generate unique username");
    }
  }

  return username;
}

async function getAllLearners(filters = {}) {
  const { school_id, grade, term, academic_year } = filters;

  let queryText = "SELECT * FROM learners WHERE 1=1";
  const params = [];
  let paramIndex = 1;

  if (school_id) {
    queryText += ` AND school_id = $${paramIndex}`;
    params.push(school_id);
    paramIndex++;
  }

  if (grade) {
    queryText += ` AND grade = $${paramIndex}`;
    params.push(grade);
    paramIndex++;
  }

  if (term) {
    queryText += ` AND term = $${paramIndex}`;
    params.push(term);
    paramIndex++;
  }

  if (academic_year) {
    queryText += ` AND academic_year = $${paramIndex}`;
    params.push(academic_year);
    paramIndex++;
  }

  queryText += " ORDER BY full_name";

  const result = await query(queryText, params);
  return result.rows;
}

async function createLearner(learnerData) {
  const { school_id, full_name, grade, term, academic_year, stream } =
    learnerData;

  // Generate unique username from learner's name
  const username = await generateUniqueUsername(full_name);
  const email = learnerData.email || `${username}@learners.educlub.local`;

  // Use default learner password from environment variables
  const { hashPassword } = require("../utils/password");
  const plainPassword = env.defaultLearnerPassword;
  const hashedPassword = await hashPassword(plainPassword);

  // Create corresponding user record for login with force_password_reset = true
  const userResult = await query(
    `INSERT INTO users (email, password, full_name, role, school_id, username, force_password_reset, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      email,
      hashedPassword,
      full_name,
      "learner",
      school_id,
      username,
      true,
      true,
    ]
  );

  // Create learner record linked to the login account for row-level security.
  const learnerResult = await query(
    `INSERT INTO learners (user_id, school_id, full_name, email, grade, term, academic_year, stream)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userResult.rows[0].id,
      school_id,
      full_name,
      email,
      grade,
      term,
      academic_year,
      stream,
    ]
  );

  return {
    learner: learnerResult.rows[0],
    user: userResult.rows[0],
    username: username,
    plainPassword: plainPassword, // Return this to send to the user via email
  };
}

async function getLearnerById(id) {
  const result = await query("SELECT * FROM learners WHERE id = $1", [id]);
  return result.rows[0];
}

async function updateLearner(id, learnerData) {
  const {
    school_id,
    full_name,
    email,
    grade,
    term,
    academic_year,
    stream,
    next_grade,
    next_term,
  } = learnerData;

  const result = await query(
    `UPDATE learners
     SET school_id = $1, full_name = $2, email = $3, grade = $4, term = $5,
         academic_year = $6, stream = $7, next_grade = $8, next_term = $9
     WHERE id = $10
     RETURNING *`,
    [
      school_id,
      full_name,
      email,
      grade,
      term,
      academic_year,
      stream,
      next_grade,
      next_term,
      id,
    ]
  );
  return result.rows[0];
}

async function deleteLearner(id) {
  await query("DELETE FROM learners WHERE id = $1", [id]);
}

async function generateCredentialCardsPDF({
  schoolId,
  learnerIds,
  systemUrl,
  defaultPassword,
}) {
  let queryText = `
    SELECT l.*, s.name as school_name, u.username, u.email as login_email
    FROM learners l
    JOIN schools s ON l.school_id = s.id
    LEFT JOIN users u ON u.id = l.user_id
    WHERE l.school_id = $1
  `;
  const params = [schoolId];

  if (learnerIds.length > 0) {
    queryText += " AND l.id = ANY($2)";
    params.push(learnerIds);
  }

  queryText += " ORDER BY l.full_name";
  const result = await query(queryText, params);

  const outputDir = path.join(__dirname, "../../uploads/reports");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `learner-cards-${schoolId}-${Date.now()}.pdf`
  );
  const doc = new PDFDocument({ size: "A4", margin: 28 });
  const output = fs.createWriteStream(outputPath);
  doc.pipe(output);

  const cardWidth = 170;
  const cardHeight = 245;
  const gap = 12;
  const startX = 28;
  const startY = 36;

  result.rows.forEach((learner, index) => {
    if (index > 0 && index % 9 === 0) doc.addPage();
    const pageIndex = index % 9;
    const col = pageIndex % 3;
    const row = Math.floor(pageIndex / 3);
    const x = startX + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);

    doc.roundedRect(x, y, cardWidth, cardHeight, 8).stroke("#d8dee8");
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("eduClub LMS", x + 12, y + 14);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#4b5563")
      .text(systemUrl, x + 12, y + 31);
    doc
      .moveTo(x + 12, y + 48)
      .lineTo(x + cardWidth - 12, y + 48)
      .stroke("#edf0f5");
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(learner.school_name, x + 12, y + 60, {
        width: cardWidth - 24,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Name: ${learner.full_name}`, x + 12, y + 92, {
        width: cardWidth - 24,
      });
    doc.text(`Grade: ${learner.grade || "Update on login"}`, x + 12, y + 120);
    doc.text(`Stream: ${learner.stream || "Update on login"}`, x + 12, y + 138);
    doc
      .font("Helvetica-Bold")
      .text(`Username: ${learner.username || "-"}`, x + 12, y + 166);
    doc.text(`Password: ${defaultPassword}`, x + 12, y + 186);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#6b7280")
      .text(
        "First login will ask the learner to reset the password and complete missing profile details.",
        x + 12,
        y + 212,
        { width: cardWidth - 24 }
      );
    doc.fillColor("#111827");
  });

  return new Promise((resolve, reject) => {
    output.on("finish", () => resolve(outputPath));
    output.on("error", reject);
    doc.on("error", reject);
    doc.end();
  });
}

module.exports = {
  getAllLearners,
  createLearner,
  getLearnerById,
  updateLearner,
  deleteLearner,
  generateCredentialCardsPDF,
  generateUsernameFromName,
  generateUniqueUsername,
  isUsernameUnique,
};
