const { query } = require('../config');

async function getAllCertificates(filters = {}) {
  const { school_id, course_id, learner_id } = filters;
  
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

  if (school_id) {
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

  queryText += ' ORDER BY c.created_at DESC';

  const result = await query(queryText, params);
  return result.rows;
}

async function getCertificateById(id) {
  const result = await query('SELECT * FROM certificates WHERE id = $1', [id]);
  return result.rows[0];
}

async function generateCertificate(certificateData) {
  const { learner_id, course_id, term, academic_year, completion_status } = certificateData;

  // Get learner and course details
  const learnerResult = await query(
    'SELECT l.*, s.name as school_name FROM learners l JOIN schools s ON l.school_id = s.id WHERE l.id = $1',
    [learner_id]
  );
  const learner = learnerResult.rows[0];

  const courseResult = await query('SELECT * FROM courses WHERE id = $1', [course_id]);
  const course = courseResult.rows[0];

  if (!learner || !course) {
    throw new Error('Learner or course not found');
  }

  const result = await query(
    `INSERT INTO certificates (learner_id, course_id, term, academic_year, completion_status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [learner_id, course_id, term, academic_year, completion_status]
  );
  return result.rows[0];
}

async function downloadCertificate(id) {
  const result = await query(
    `SELECT c.*, l.full_name, s.name as school_name, cr.name as course_name
     FROM certificates c
     JOIN learners l ON c.learner_id = l.id
     JOIN schools s ON l.school_id = s.id
     JOIN courses cr ON c.course_id = cr.id
     WHERE c.id = $1`,
    [id]
  );
  const certificate = result.rows[0];

  if (!certificate) {
    throw new Error('Certificate not found');
  }

  // For now, return the certificate data
  // In production, this would generate a PDF
  return certificate;
}

async function approveCertificate(id, approvedBy) {
  const result = await query(
    `UPDATE certificates
     SET status = 'approved', approved_by = $1, approved_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [approvedBy, id]
  );

  if (result.rows.length === 0) {
    throw new Error('Certificate not found');
  }

  return result.rows[0];
}

module.exports = {
  getAllCertificates,
  getCertificateById,
  generateCertificate,
  downloadCertificate,
  approveCertificate,
};
