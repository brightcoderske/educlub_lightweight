const { query } = require("../config");
const notificationsService = require("../services/notifications.service");
const teacherAssignmentsService = require("../services/teacherAssignments.service");

function isSchoolScopedStaff(user = {}) {
  return user.role === "school_admin" || user.role === "teacher";
}

function allocationErrorStatus(error) {
  return /not assigned|cannot|outside/i.test(error.message || "") ? 403 : 500;
}

async function getAllAllocations(req, res) {
  try {
    const { school_id, learner_id, course_id, term, academic_year, category } =
      req.query;

    let queryText = `
      SELECT a.*,
             l.full_name as learner_name,
             l.email as learner_email,
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

    if (isSchoolScopedStaff(req.user)) {
      queryText += ` AND l.school_id = $${paramIndex}`;
      params.push(req.user.schoolId);
      paramIndex++;
      if (req.user.role === "teacher") {
        queryText += ` AND EXISTS (
          SELECT 1 FROM course_teacher_assignments cta
          WHERE cta.course_id = a.course_id
            AND cta.teacher_user_id = $${paramIndex}
            AND cta.is_active = true
        )`;
        params.push(req.user.userId);
        paramIndex++;
      }
    } else if (req.user.role === "learner") {
      queryText += ` AND l.user_id = $${paramIndex}`;
      params.push(req.user.userId);
      paramIndex++;
    } else if (school_id) {
      queryText += ` AND l.school_id = $${paramIndex}`;
      params.push(school_id);
      paramIndex++;
    }

    if (learner_id && req.user.role !== "learner") {
      queryText += ` AND a.learner_id = $${paramIndex}`;
      params.push(learner_id);
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

    if (category === "weekly_typing" || category === "weekly_quiz") {
      queryText += ` AND c.course_category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    } else if (category === "weekly") {
      queryText += " AND c.course_category IN ('weekly_typing', 'weekly_quiz')";
    } else if (category !== "all") {
      queryText += " AND COALESCE(c.course_category, 'general') = 'general'";
    }

    queryText += " ORDER BY l.full_name";

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get allocations error:", error);
    res.status(500).json({ error: "Failed to get allocations" });
  }
}

async function createAllocation(req, res) {
  try {
    const { learner_id, course_id, term, academic_year } = req.body;

    if (isSchoolScopedStaff(req.user)) {
      if (req.user.role === "teacher") {
        await teacherAssignmentsService.assertTeacherCourseAccess(
          req.user,
          course_id,
        );
      }
      const learnerResult = await query(
        "SELECT school_id FROM learners WHERE id = $1",
        [learner_id]
      );
      const learner = learnerResult.rows[0];

      if (!learner || learner.school_id !== req.user.schoolId) {
        return res
          .status(403)
          .json({ error: "Learner is outside your school" });
      }

      const courseResult = await query(
        "SELECT id FROM courses WHERE id = $1 AND school_id = $2 AND is_active = true",
        [course_id, req.user.schoolId]
      );
      if (!courseResult.rows[0]) {
        return res
          .status(403)
          .json({ error: "Allocate learners to your school's adopted course version." });
      }
    }

    const result = await query(
      `INSERT INTO course_allocations (learner_id, course_id, term, academic_year)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [learner_id, course_id, term, academic_year]
    );

    const detailResult = await query(
      `SELECT l.user_id, l.school_id, l.full_name, c.name as course_name
       FROM learners l
       JOIN courses c ON c.id = $1
       WHERE l.id = $2`,
      [course_id, learner_id]
    );
    const detail = detailResult.rows[0];

    if (detail?.user_id) {
      await notificationsService.notifyUser(detail.user_id, {
        title: "Course allocated",
        message: `You have been allocated ${detail.course_name}.`,
        notification_type: "course_allocated",
        entity_type: "course_allocation",
        entity_id: result.rows[0].id,
      });
    }

    if (detail?.school_id) {
      await notificationsService.notifyRole("school_admin", {
        school_id: detail.school_id,
        title: "Learner course allocation",
        message: `${detail.full_name} was allocated ${detail.course_name}.`,
        notification_type: "course_allocated",
        entity_type: "course_allocation",
        entity_id: result.rows[0].id,
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create allocation error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to create allocation" });
  }
}

async function getAllocationById(req, res) {
  try {
    const result = await query(
      `SELECT a.*, l.school_id, l.user_id AS learner_user_id
       FROM course_allocations a
       JOIN learners l ON l.id = a.learner_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    const allocation = result.rows[0];

    if (!allocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }
    if (
      req.user.role === "learner" &&
      Number(allocation.learner_user_id) !== Number(req.user.userId)
    ) {
      return res.status(403).json({ error: "Allocation is outside your access" });
    }
    if (
      isSchoolScopedStaff(req.user) &&
      Number(allocation.school_id) !== Number(req.user.schoolId)
    ) {
      return res.status(403).json({ error: "Allocation is outside your school" });
    }
    if (req.user.role === "teacher") {
      await teacherAssignmentsService.assertTeacherCourseAccess(
        req.user,
        allocation.course_id,
      );
    }

    res.json(allocation);
  } catch (error) {
    console.error("Get allocation error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to get allocation" });
  }
}

async function updateAllocation(req, res) {
  try {
    const { learner_id, course_id, term, academic_year, status } = req.body;

    const existingResult = await query(
      `SELECT a.*, l.school_id
       FROM course_allocations a
       JOIN learners l ON l.id = a.learner_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    if (isSchoolScopedStaff(req.user) && Number(existing.school_id) !== Number(req.user.schoolId)) {
      return res.status(403).json({ error: "Allocation is outside your school" });
    }

    if (isSchoolScopedStaff(req.user)) {
      if (req.user.role === "teacher") {
        await teacherAssignmentsService.assertTeacherCourseAccess(
          req.user,
          course_id,
        );
      }
      const learnerResult = await query(
        "SELECT school_id FROM learners WHERE id = $1",
        [learner_id]
      );
      const learner = learnerResult.rows[0];

      if (!learner || Number(learner.school_id) !== Number(req.user.schoolId)) {
        return res
          .status(403)
          .json({ error: "Learner is outside your school" });
      }

      const courseResult = await query(
        "SELECT id FROM courses WHERE id = $1 AND school_id = $2 AND is_active = true",
        [course_id, req.user.schoolId]
      );
      if (!courseResult.rows[0]) {
        return res
          .status(403)
          .json({ error: "Allocation must use your school's adopted course version." });
      }
    }

    const result = await query(
      `UPDATE course_allocations
       SET learner_id = $1, course_id = $2, term = $3, academic_year = $4, status = $5
       WHERE id = $6
       RETURNING *`,
      [learner_id, course_id, term, academic_year, status, req.params.id]
    );

    const updated = result.rows[0];

    res.json(updated);
  } catch (error) {
    console.error("Update allocation error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to update allocation" });
  }
}

async function deleteAllocation(req, res) {
  try {
    if (isSchoolScopedStaff(req.user)) {
      const allocationResult = await query(
        `SELECT l.school_id, a.course_id
         FROM course_allocations a
         JOIN learners l ON a.learner_id = l.id
         WHERE a.id = $1`,
        [req.params.id]
      );
      const allocation = allocationResult.rows[0];

      if (!allocation || Number(allocation.school_id) !== Number(req.user.schoolId)) {
        return res
          .status(403)
          .json({ error: "Allocation is outside your school" });
      }
      if (req.user.role === "teacher") {
        await teacherAssignmentsService.assertTeacherCourseAccess(
          req.user,
          allocation.course_id,
        );
      }
    }

    const result = await query(
      "DELETE FROM course_allocations WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    res.json({ message: "Allocation deleted successfully" });
  } catch (error) {
    console.error("Delete allocation error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to delete allocation" });
  }
}

async function bulkAllocate(req, res) {
  try {
    const { grade, stream, course_id, term, academic_year } = req.body;
    const schoolId =
      req.user.role === "school_admin" || req.user.role === "teacher"
        ? req.user.schoolId
        : req.body.school_id;

    if (!schoolId) {
      return res.status(400).json({ error: "School is required" });
    }

    const courseResult = await query(
      "SELECT id FROM courses WHERE id = $1 AND school_id = $2 AND is_active = true",
      [course_id, schoolId]
    );
    if (!courseResult.rows[0]) {
      return res
        .status(403)
        .json({ error: "Bulk allocation must use your school's adopted course version." });
    }
    if (req.user.role === "teacher") {
      await teacherAssignmentsService.assertTeacherCourseAccess(
        req.user,
        course_id,
      );
    }

    const gradeMatchSql = `
      (
        LOWER(COALESCE(grade, '')) = LOWER($5)
        OR regexp_replace(COALESCE(grade, ''), '[^0-9]', '', 'g') =
           regexp_replace(COALESCE($5, ''), '[^0-9]', '', 'g')
      )
    `;
    let queryText = `
      INSERT INTO course_allocations (learner_id, course_id, term, academic_year, status)
       SELECT id, $1, $2, $3, 'active'
       FROM learners
       WHERE school_id = $4 AND ${gradeMatchSql}
    `;
    const params = [course_id, term, academic_year, schoolId, grade];

    if (stream) {
      queryText += " AND stream = $6";
      params.push(stream);
    }

    queryText += `
      ON CONFLICT (learner_id, course_id, term, academic_year)
      DO UPDATE SET
        status = 'active',
        completed_at = NULL
      RETURNING *
    `;

    const matchCountResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM learners
       WHERE school_id = $1
         AND (
           LOWER(COALESCE(grade, '')) = LOWER($2)
           OR regexp_replace(COALESCE(grade, ''), '[^0-9]', '', 'g') =
              regexp_replace(COALESCE($2, ''), '[^0-9]', '', 'g')
         )
         ${stream ? "AND stream = $3" : ""}`,
      stream ? [schoolId, grade, stream] : [schoolId, grade]
    );

    const result = await query(queryText, params);

    if (result.rows.length > 0) {
      await notificationsService.notifyRole("school_admin", {
        school_id: schoolId,
        title: "Bulk course allocation",
        message: `${result.rows.length} learners were allocated to a course.`,
        notification_type: "course_allocated",
        entity_type: "course_allocation",
      });
    }

    const matchedLearners = Number(matchCountResult.rows[0]?.total || 0);
    const message =
      matchedLearners === 0
        ? "No learners matched the selected grade and stream."
        : result.rows.length === 0
        ? "All matching learners were already allocated to this course for the selected term."
        : `Allocated ${result.rows.length} learners to course`;

    res.status(201).json({
      message,
      allocations: result.rows,
      matchedLearners,
    });
  } catch (error) {
    console.error("Bulk allocate error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to bulk allocate" });
  }
}

module.exports = {
  getAllAllocations,
  createAllocation,
  getAllocationById,
  updateAllocation,
  deleteAllocation,
  bulkAllocate,
};
