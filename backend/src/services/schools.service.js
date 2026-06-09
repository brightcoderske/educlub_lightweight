const { query } = require('../config');

async function getAllSchools() {
  const result = await query('SELECT * FROM schools ORDER BY name');
  return result.rows;
}

async function createSchool(schoolData) {
  const { name, code, email, phone, address, logo_url } = schoolData;
  const result = await query(
    `INSERT INTO schools (name, code, email, phone, address, logo_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, code, email, phone, address, logo_url]
  );
  return result.rows[0];
}

async function getSchoolById(id) {
  const result = await query('SELECT * FROM schools WHERE id = $1', [id]);
  return result.rows[0];
}

async function updateSchool(id, schoolData) {
  const { name, code, email, phone, address, logo_url } = schoolData;
  const result = await query(
    `UPDATE schools
     SET name = $1, code = $2, email = $3, phone = $4, address = $5, logo_url = $6
     WHERE id = $7
     RETURNING *`,
    [name, code, email, phone, address, logo_url, id]
  );
  return result.rows[0];
}

async function deleteSchool(id) {
  await query('DELETE FROM schools WHERE id = $1', [id]);
}

module.exports = { getAllSchools, createSchool, getSchoolById, updateSchool, deleteSchool };
