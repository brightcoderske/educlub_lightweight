const { query } = require("../config");
const { withTransaction } = require("../database/transaction");
const { isUniqueViolation } = require("../utils/dbErrors");
const { normalizeGrade } = require("../utils/grade");
const academicService = require("../services/academic.service");
const independentLearnersService = require("../services/independentLearners.service");
const notificationsService = require("../services/notifications.service");
const teacherAssignmentsService = require("../services/teacherAssignments.service");

function isSchoolScopedStaff(user = {}) {
  return user.role === "school_admin" || user.role === "teacher";
}

function allocationErrorStatus(error) {
  if (error.status) return error.status;
  return /not assigned|cannot|outside/i.test(error.message || "") ? 403 : 500;
}

// A learner holds a course once per term, and the table enforces it. Meeting that
// rule is the person's clash to resolve, not a server fault, so say what it is
// rather than passing on the database's own wording as a 500.
function alreadyAllocated(res, { term, academic_year: academicYear }) {
  return res.status(409).json({
    error: `That learner already has this course for ${term} ${academicYear}.`,
  });
}

async function assertActiveAllocationTerm(term, academicYear) {
  const activeTerm = await academicService.getActiveTerm("regular");
  if (!activeTerm) {
    const error = new Error("No active academic term is available for allocation.");
    error.status = 400;
    throw error;
  }

  const activeAcademicYear =
    activeTerm.academic_year ||
    new Date(activeTerm.start_date || Date.now()).getFullYear();

  if (
    String(term || "") !== String(activeTerm.name || "") ||
    String(academicYear || "") !== String(activeAcademicYear || "")
  ) {
    const error = new Error(
      `Allocate courses only in the active term: ${activeTerm.name} ${activeAcademicYear}.`
    );
    error.status = 400;
    throw error;
  }
}

async function getAllAllocations(req, res) {
  try {
    const { school_id, learner_id, course_id, term, academic_year, category } =
      req.query;

    if (req.user.role === "learner") {
      await independentLearnersService
        .ensurePreviewAllocationsForLearnerUser(req.user.userId)
        .catch((error) => {
          console.error("Independent preview allocation self-heal error:", error);
        });
    }

    let queryText = `
      SELECT a.*,
             l.full_name as learner_name,
             l.email as learner_email,
             l.grade,
             l.stream,
             c.name as course_name,
             c.course_category,
             c.independent_price_amount,
             c.independent_currency
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
      queryText +=
        " AND COALESCE(c.course_category, 'general') NOT IN ('weekly_typing', 'weekly_quiz')";
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

    await assertActiveAllocationTerm(term, academic_year);

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
    if (isUniqueViolation(error)) return alreadyAllocated(res, req.body);
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

    await assertActiveAllocationTerm(term, academic_year);

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
    if (isUniqueViolation(error)) return alreadyAllocated(res, req.body);
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

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Allocates a course to every learner in a grade (and stream) for the active term.
 * A class is the learners who are not graduated and whose grade is the one chosen,
 * however it was typed ("Grade 5", "grade 5", "5"): both sides go through
 * normalizeGrade, so a grade that is not one matches nobody rather than everybody
 * who has no grade.
 *
 * Nobody is allocated twice. A learner who already has the course for the term is
 * left exactly as they are, so a completed course is never reset, and only one
 * whose allocation was switched off is switched back on. The answer the person
 * needs is "how many were new and how many were already there", which is why the
 * work is done here and not in one INSERT ... SELECT: that statement cannot be
 * given RETURNING on MySQL or MariaDB - the emulation adds an unqualified id that
 * is ambiguous between the two tables, which made every bulk allocation fail.
 */
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
    const chosenGrade = normalizeGrade(grade);
    if (!chosenGrade) {
      return res.status(400).json({ error: "Choose the grade to allocate." });
    }
    if (!course_id) {
      return res.status(400).json({ error: "Choose the course to allocate." });
    }

    await assertActiveAllocationTerm(term, academic_year);

    const courseResult = await query(
      "SELECT id, name FROM courses WHERE id = $1 AND school_id = $2 AND is_active = true",
      [course_id, schoolId]
    );
    const course = courseResult.rows[0];
    if (!course) {
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

    const roster = await query(
      `SELECT id, grade FROM learners
       WHERE school_id = $1 AND graduation_status <> 'graduated'${stream ? " AND stream = $2" : ""}`,
      stream ? [schoolId, stream] : [schoolId]
    );
    const learnerIds = roster.rows
      .filter((row) => normalizeGrade(row.grade) === chosenGrade)
      .map((row) => row.id);
    if (learnerIds.length === 0) {
      return res.json({
        message: "No learners matched the selected grade and stream.",
        allocations: [],
        matchedLearners: 0,
        allocated: 0,
        alreadyAllocated: 0,
      });
    }

    const existing = await query(
      `SELECT id, learner_id, status
       FROM course_allocations
       WHERE course_id = $1 AND term = $2 AND academic_year = $3 AND learner_id = ANY($4)`,
      [course.id, term, academic_year, learnerIds]
    );
    const haveIt = new Set(existing.rows.map((row) => row.learner_id));
    const toCreate = learnerIds.filter((id) => !haveIt.has(id));
    const toSwitchOn = existing.rows.filter(
      (row) => row.status === "inactive" || row.status === "dropped"
    );
    const alreadyAllocated = learnerIds.length - toCreate.length - toSwitchOn.length;

    await withTransaction(async (client) => {
      if (toCreate.length > 0) {
        const rows = toCreate.map((_, index) => `($${index + 4}, $1, $2, $3, 'active')`);
        // DO NOTHING covers someone else allocating the same class at the same moment.
        await client.query(
          `INSERT INTO course_allocations (learner_id, course_id, term, academic_year, status)
           VALUES ${rows.join(", ")}
           ON CONFLICT (learner_id, course_id, term, academic_year) DO NOTHING`,
          [course.id, term, academic_year, ...toCreate]
        );
      }
      if (toSwitchOn.length > 0) {
        await client.query(
          `UPDATE course_allocations
           SET status = 'active', completed_at = NULL
           WHERE id = ANY($1)`,
          [toSwitchOn.map((row) => row.id)]
        );
      }
    });

    const changedLearnerIds = [...toCreate, ...toSwitchOn.map((row) => row.learner_id)];
    const allocations =
      changedLearnerIds.length === 0
        ? []
        : (
            await query(
              `SELECT * FROM course_allocations
               WHERE course_id = $1 AND term = $2 AND academic_year = $3 AND learner_id = ANY($4)`,
              [course.id, term, academic_year, changedLearnerIds]
            )
          ).rows;

    if (allocations.length > 0) {
      await notificationsService.notifyRole("school_admin", {
        school_id: schoolId,
        title: "Bulk course allocation",
        message: `${plural(allocations.length, "learner")} allocated to ${course.name}.`,
        notification_type: "course_allocated",
        entity_type: "course_allocation",
      });
    }

    const already =
      alreadyAllocated > 0
        ? ` ${plural(alreadyAllocated, "learner")} already had it and ${alreadyAllocated === 1 ? "was" : "were"} left as they are.`
        : "";
    const message =
      allocations.length === 0
        ? `All ${plural(learnerIds.length, "matching learner")} already had ${course.name} for ${term} ${academic_year}.`
        : `Allocated ${plural(allocations.length, "learner")} to ${course.name}.${already}`;

    res.status(allocations.length > 0 ? 201 : 200).json({
      message,
      allocations,
      matchedLearners: learnerIds.length,
      allocated: allocations.length,
      alreadyAllocated,
    });
  } catch (error) {
    console.error("Bulk allocate error:", error);
    res
      .status(allocationErrorStatus(error))
      .json({ error: error.message || "Failed to bulk allocate" });
  }
}

async function grantManualAccess(req, res) {
  try {
    const { access_level = "grant", payment_reference, note } = req.body;
    const allowedLevels = ["paid", "grant", "scholarship"];
    if (!allowedLevels.includes(access_level)) {
      return res.status(400).json({ error: "Choose paid, grant, or scholarship access." });
    }
    const cleanReference = String(payment_reference || "").trim();
    const cleanNote = String(note || "").trim();
    if (!cleanReference && access_level === "paid") {
      return res.status(400).json({ error: "Payment reference is required for paid access." });
    }
    if (!cleanNote) {
      return res.status(400).json({ error: "Add a short note for this manual access change." });
    }

    const result = await query(
      `UPDATE course_allocations
       SET access_level = $1,
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
           payment_reference = COALESCE(NULLIF($2, ''), payment_reference),
           status = CASE WHEN status = 'inactive' THEN 'active' ELSE status END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [access_level, cleanReference, req.params.id],
    );

    const allocation = result.rows[0];
    if (!allocation) {
      return res.status(404).json({ error: "Allocation not found" });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'manual_course_access_grant', 'course_allocation', $2, $3)`,
      [
        req.user.userId,
        allocation.id,
        JSON.stringify({
          access_level,
          payment_reference: cleanReference || null,
          note: cleanNote,
        }),
      ],
    );

    res.json(allocation);
  } catch (error) {
    console.error("Manual allocation access error:", error);
    res.status(400).json({ error: error.message || "Failed to grant manual access" });
  }
}

module.exports = {
  getAllAllocations,
  createAllocation,
  getAllocationById,
  updateAllocation,
  deleteAllocation,
  bulkAllocate,
  grantManualAccess,
};
