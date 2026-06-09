const { query } = require("../config");

async function getAllCertificates(req, res) {
  try {
    const { school_id, course_id, learner_id } = req.query;

    let queryText = `
      SELECT c.*, l.full_name as learner_name, s.name as school_name, 
             cr.name as course_name, cr.description as course_description
      FROM certificates c
      JOIN learners l ON c.learner_id = l.id
      JOIN schools s ON l.school_id = s.id
      JOIN courses cr ON c.course_id = cr.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === "school_admin") {
      queryText += ` AND l.school_id = $${paramIndex}`;
      params.push(req.user.schoolId);
      paramIndex++;
    } else if (req.user.role === "learner") {
      queryText += ` AND l.user_id = $${paramIndex}`;
      params.push(req.user.userId);
      paramIndex++;
    } else if (school_id) {
      queryText += ` AND l.school_id = $${paramIndex}`;
      params.push(school_id);
      paramIndex++;
    }

    if (course_id) {
      queryText += ` AND c.course_id = $${paramIndex}`;
      params.push(course_id);
      paramIndex++;
    }

    if (learner_id) {
      queryText += ` AND c.learner_id = $${paramIndex}`;
      params.push(learner_id);
      paramIndex++;
    }

    queryText += " ORDER BY c.created_at DESC";

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get certificates error:", error);
    res.status(500).json({ error: "Failed to get certificates" });
  }
}

async function getCertificateById(req, res) {
  try {
    const result = await query("SELECT * FROM certificates WHERE id = $1", [
      req.params.id,
    ]);
    const certificate = result.rows[0];

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    res.json(certificate);
  } catch (error) {
    console.error("Get certificate error:", error);
    res.status(500).json({ error: "Failed to get certificate" });
  }
}

async function generateCertificate(req, res) {
  try {
    const { learner_id, course_id, term, academic_year, completion_status } =
      req.body;

    // Get learner and course details
    const learnerResult = await query(
      "SELECT l.*, s.name as school_name FROM learners l JOIN schools s ON l.school_id = s.id WHERE l.id = $1",
      [learner_id]
    );
    const learner = learnerResult.rows[0];

    const courseResult = await query("SELECT * FROM courses WHERE id = $1", [
      course_id,
    ]);
    const course = courseResult.rows[0];

    if (!learner || !course) {
      return res.status(404).json({ error: "Learner or course not found" });
    }

    const result = await query(
      `INSERT INTO certificates (learner_id, course_id, term, academic_year, completion_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [learner_id, course_id, term, academic_year, completion_status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Generate certificate error:", error);
    res.status(500).json({ error: "Failed to generate certificate" });
  }
}

async function downloadCertificate(req, res) {
  try {
    const result = await query(
      `SELECT c.*, l.full_name, s.name as school_name, cr.name as course_name
       FROM certificates c
       JOIN learners l ON c.learner_id = l.id
       JOIN schools s ON l.school_id = s.id
       JOIN courses cr ON c.course_id = cr.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    const certificate = result.rows[0];

    if (!certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    // For now, return the certificate data
    // In production, this would generate a PDF
    res.json(certificate);
  } catch (error) {
    console.error("Download certificate error:", error);
    res.status(500).json({ error: "Failed to download certificate" });
  }
}

async function approveCertificate(req, res) {
  try {
    const result = await query(
      `UPDATE certificates
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Approve certificate error:", error);
    res.status(500).json({ error: "Failed to approve certificate" });
  }
}

module.exports = {
  getAllCertificates,
  getCertificateById,
  generateCertificate,
  downloadCertificate,
  approveCertificate,
};
