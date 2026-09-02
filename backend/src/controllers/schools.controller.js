const { query } = require("../config");
const fs = require("fs/promises");
const path = require("path");

function getPublicUploadUrl(req, relativePath) {
  return `${req.protocol}://${req.get("host")}${relativePath.replace(
    /\\/g,
    "/"
  )}`;
}

function cleanTextField(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return "";
  }

  if (
    value.includes("System.Management.Automation.PSMethod") ||
    value.includes("OverloadDefinitions") ||
    value.includes("MemberType")
  ) {
    return "";
  }

  return value;
}

function cleanSchoolRow(row) {
  return {
    ...row,
    name: cleanTextField(row.name) || row.name,
    code: cleanTextField(row.code) || row.code,
    email: cleanTextField(row.email),
    phone: cleanTextField(row.phone),
    address: cleanTextField(row.address),
    logo_url: cleanTextField(row.logo_url),
  };
}

// Only the system administrator has a reason to see the whole directory of
// schools. Everyone else - school admin, teacher, learner - sees the one school
// they belong to, so a school's contact details and roll size are not readable
// by anybody who happens to hold a token.
function ownSchoolId(user = {}) {
  const id = Number(user.schoolId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getAllSchools(req, res) {
  try {
    const params = [];
    let scopeSql = "";

    if (req.user.role !== "system_admin") {
      const schoolId = ownSchoolId(req.user);
      if (!schoolId) {
        return res.json([]);
      }
      params.push(schoolId);
      scopeSql = `WHERE s.id = $${params.length}::integer`;
    }

    const result = await query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM learners l WHERE l.school_id = s.id) AS learners_count
       FROM schools s
       ${scopeSql}
       ORDER BY s.name`,
      params
    );
    res.json(result.rows.map(cleanSchoolRow));
  } catch (error) {
    console.error("Get schools error:", error);
    res.status(500).json({ error: "Failed to get schools" });
  }
}

async function getSchoolLearners(req, res) {
  try {
    const result = await query(
      `SELECT l.id, l.full_name, l.email, l.grade, l.stream, l.term, l.academic_year,
              u.username, u.is_active
       FROM learners l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.school_id = $1
       ORDER BY l.full_name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get school learners error:", error);
    res.status(500).json({ error: "Failed to get school learners" });
  }
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportSchoolLearners(req, res) {
  try {
    const result = await query(
      `SELECT l.full_name, u.username, l.email, l.grade, l.stream, l.term, l.academic_year,
              s.name AS school_name
       FROM learners l
       JOIN schools s ON s.id = l.school_id
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.school_id = $1
       ORDER BY l.full_name`,
      [req.params.id]
    );
    const schoolName = result.rows[0]?.school_name || "school";
    const rows = [
      ["Learner", "Username", "Email", "Grade", "Class", "Term", "Academic Year"],
      ...result.rows.map((row) => [
        row.full_name,
        row.username,
        row.email,
        row.grade,
        row.stream,
        row.term,
        row.academic_year,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const safeName = schoolName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

    res
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName || "school"}-learners.csv"`,
      })
      .send(csv);
  } catch (error) {
    console.error("Export school learners error:", error);
    res.status(500).json({ error: "Failed to export school learners" });
  }
}

async function createSchool(req, res) {
  try {
    const {
      name,
      code,
      email,
      phone,
      address,
      logo_url,
      grades_config,
      streams_config,
      allow_self_registration,
    } = req.body;

    const result = await query(
      `INSERT INTO schools (name, code, email, phone, address, logo_url, grades_config, streams_config, allow_self_registration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        code,
        email,
        phone,
        cleanTextField(address),
        logo_url,
        JSON.stringify(grades_config || []),
        JSON.stringify(streams_config || []),
        Boolean(allow_self_registration),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create school error:", error);
    res.status(500).json({ error: "Failed to create school" });
  }
}

async function getSchoolById(req, res) {
  try {
    if (
      req.user.role !== "system_admin" &&
      Number(req.params.id) !== ownSchoolId(req.user)
    ) {
      return res.status(403).json({ error: "School is outside your access" });
    }

    const result = await query("SELECT * FROM schools WHERE id = $1", [
      req.params.id,
    ]);
    const school = result.rows[0];

    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(cleanSchoolRow(school));
  } catch (error) {
    console.error("Get school error:", error);
    res.status(500).json({ error: "Failed to get school" });
  }
}

async function updateSchool(req, res) {
  try {
    const {
      name,
      code,
      email,
      phone,
      address,
      logo_url,
      grades_config,
      streams_config,
      allow_self_registration,
    } = req.body;

    if (
      (req.user.role === "school_admin" || req.user.role === "teacher") &&
      Number(req.params.id) !== ownSchoolId(req.user)
    ) {
      return res.status(403).json({ error: "School is outside your access" });
    }

    if (req.user.role === "teacher") {
      const existing = await query("SELECT * FROM schools WHERE id = $1", [
        req.params.id,
      ]);
      const school = existing.rows[0];

      if (!school) {
        return res.status(404).json({ error: "School not found" });
      }

      const result = await query(
        `UPDATE schools
         SET grades_config = COALESCE($1, grades_config),
             streams_config = COALESCE($2, streams_config),
             allow_self_registration = COALESCE($3, allow_self_registration),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          grades_config ? JSON.stringify(grades_config) : null,
          streams_config ? JSON.stringify(streams_config) : null,
          allow_self_registration === undefined ? null : Boolean(allow_self_registration),
          req.params.id,
        ]
      );

      return res.json(result.rows[0]);
    }

    const result = await query(
      `UPDATE schools
       SET name = $1, code = $2, email = $3, phone = $4, address = $5, logo_url = $6,
           grades_config = COALESCE($7, grades_config),
           streams_config = COALESCE($8, streams_config),
           allow_self_registration = COALESCE($9, allow_self_registration),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name,
        code,
        email,
        phone,
        cleanTextField(address),
        logo_url,
        grades_config ? JSON.stringify(grades_config) : null,
        streams_config ? JSON.stringify(streams_config) : null,
        allow_self_registration === undefined ? null : Boolean(allow_self_registration),
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update school error:", error);
    res.status(500).json({ error: "Failed to update school" });
  }
}

async function uploadSchoolLogo(req, res) {
  try {
    const { fileName, dataUrl } = req.body;

    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return res
        .status(400)
        .json({ error: "Please upload a PNG or JPG school logo." });
    }

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
    if (!match) {
      return res
        .status(400)
        .json({ error: "Logo must be a PNG or JPG image." });
    }

    const extension = match[1].includes("png") ? "png" : "jpg";
    const safeName = `${Date.now()}-${(fileName || "school-logo")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase()}.${extension}`;
    const uploadDir = path.join(__dirname, "../../uploads/school-logos");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, Buffer.from(match[2], "base64"), { flag: "wx" });

    res.json({
      logo_url: getPublicUploadUrl(req, `/uploads/school-logos/${safeName}`),
    });
  } catch (error) {
    console.error("Upload school logo error:", error);
    res.status(500).json({ error: "Failed to upload school logo" });
  }
}

async function deleteSchool(req, res) {
  try {
    const result = await query(
      "DELETE FROM schools WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ message: "School deleted successfully" });
  } catch (error) {
    console.error("Delete school error:", error);
    res.status(500).json({ error: "Failed to delete school" });
  }
}

module.exports = {
  getAllSchools,
  createSchool,
  getSchoolById,
  updateSchool,
  uploadSchoolLogo,
  getSchoolLearners,
  exportSchoolLearners,
  deleteSchool,
};
