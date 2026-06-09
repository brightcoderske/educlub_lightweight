const { query } = require("../config");

async function getAllAllocations(filters = {}) {
  const { school_id, course_id, term, academic_year, learner_id } = filters;

  let queryText = `
    SELECT a.*, 
           l.full_name as learner_name, 
           l.grade, 
           l.stream, 
           c.name as course_name,
           c.course_category
    FROM course_allocations a
    JOIN learners l ON a.learner_id = l.id
    JOIN courses c ON a.course_id = c.id
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
    queryText += ` AND a.course_id = $${paramIndex}`;
    params.push(course_id);
    paramIndex++;
  }

  if (term) {
    queryText += ` AND a.term = $${paramIndex}`;
    params.push(term);
    paramIndex++;
  }

  if (academic_year) {
    queryText += ` AND a.academic_year = $${paramIndex}`;
    params.push(academic_year);
    paramIndex++;
  }

  if (learner_id) {
    queryText += ` AND a.learner_id = $${paramIndex}`;
    params.push(learner_id);
    paramIndex++;
  }

  queryText += " ORDER BY l.full_name";

  const result = await query(queryText, params);
  return result.rows;
}

async function createAllocation(allocationData) {
  const { learner_id, course_id, term, academic_year, start_date, end_date } =
    allocationData;

  const result = await query(
    `INSERT INTO course_allocations (learner_id, course_id, term, academic_year, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [learner_id, course_id, term, academic_year, start_date, end_date]
  );
  return result.rows[0];
}

async function getAllocationById(id) {
  const result = await query("SELECT * FROM course_allocations WHERE id = $1", [
    id,
  ]);
  return result.rows[0];
}

async function updateAllocation(id, allocationData) {
  const { learner_id, course_id, term, academic_year, status } = allocationData;

  const result = await query(
    `UPDATE course_allocations
     SET learner_id = $1, course_id = $2, term = $3, academic_year = $4, status = $5
     WHERE id = $6
     RETURNING *`,
    [learner_id, course_id, term, academic_year, status, id]
  );
  return result.rows[0];
}

async function deleteAllocation(id) {
  await query("DELETE FROM course_allocations WHERE id = $1", [id]);
}

async function bulkAllocate(bulkData) {
  const {
    school_id,
    grade,
    course_id,
    term,
    academic_year,
    start_date,
    end_date,
  } = bulkData;

  const result = await query(
    `INSERT INTO course_allocations (learner_id, course_id, term, academic_year, start_date, end_date)
     SELECT id, $1, $2, $3, $4, $5
     FROM learners
     WHERE school_id = $6 AND grade = $7
     RETURNING *`,
    [course_id, term, academic_year, start_date, end_date, school_id, grade]
  );

  return {
    count: result.rows.length,
    allocations: result.rows,
  };
}

module.exports = {
  getAllAllocations,
  createAllocation,
  getAllocationById,
  updateAllocation,
  deleteAllocation,
  bulkAllocate,
};
