const { query } = require("../config");
const notificationsService = require("./notifications.service");
const {
  normalizePositiveId,
  teacherRequiresAssignment,
  canManageTeacherAssignments,
} = require("./teacherAssignmentPolicy");

async function getCourse(courseId) {
  const result = await query(
    "SELECT id, school_id, name, template_id, template_version FROM courses WHERE id = $1",
    [courseId],
  );
  return result.rows[0] || null;
}

async function isTeacherAssignedToCourse(teacherUserId, courseId, schoolId = null) {
  const result = await query(
    `SELECT cta.id
     FROM course_teacher_assignments cta
     JOIN courses c ON c.id = cta.course_id
     WHERE cta.teacher_user_id = $1
       AND cta.course_id = $2
       AND cta.is_active = true
       AND ($3::integer IS NULL OR c.school_id = $3::integer)`,
    [teacherUserId, courseId, normalizePositiveId(schoolId)],
  );
  return Boolean(result.rows[0]);
}

async function assertTeacherCourseAccess(user = {}, courseId) {
  if (user.role !== "teacher") return true;
  const allowed = await isTeacherAssignedToCourse(
    user.userId,
    courseId,
    user.schoolId,
  );
  if (!allowed) throw new Error("This course is not assigned to you.");
  return true;
}

async function listTeacherCourseIds(user = {}) {
  if (user.role !== "teacher") return [];
  const result = await query(
    `SELECT course_id
     FROM course_teacher_assignments
     WHERE teacher_user_id = $1 AND is_active = true`,
    [user.userId],
  );
  return result.rows.map((row) => Number(row.course_id));
}

async function assertTeacherLearnerAccess(user = {}, learnerId) {
  if (user.role !== "teacher") return true;
  const result = await query(
    `SELECT 1
     FROM course_teacher_assignments cta
     JOIN course_allocations ca ON ca.course_id = cta.course_id
     JOIN learners l ON l.id = ca.learner_id
     WHERE cta.teacher_user_id = $1
       AND cta.is_active = true
       AND ca.learner_id = $2
       AND l.school_id = $3
     LIMIT 1`,
    [user.userId, learnerId, user.schoolId],
  );
  if (!result.rows[0]) throw new Error("This learner is not assigned to you.");
  return true;
}

async function listTeacherAssignments(filters = {}, user = {}) {
  const params = [];
  let where = "WHERE 1=1";
  if (user.role === "teacher") {
    params.push(user.userId);
    where += ` AND cta.teacher_user_id = $${params.length}`;
  } else if (user.role === "school_admin") {
    params.push(user.schoolId);
    where += ` AND c.school_id = $${params.length}`;
  } else if (filters.school_id) {
    params.push(filters.school_id);
    where += ` AND c.school_id = $${params.length}`;
  }
  if (filters.course_id) {
    params.push(filters.course_id);
    where += ` AND cta.course_id = $${params.length}`;
  }

  const result = await query(
    `SELECT cta.*, c.name AS course_name, c.school_id,
            u.full_name AS teacher_name, u.email AS teacher_email
     FROM course_teacher_assignments cta
     JOIN courses c ON c.id = cta.course_id
     JOIN users u ON u.id = cta.teacher_user_id
     ${where}
     ORDER BY c.name, u.full_name`,
    params,
  );
  return result.rows;
}

async function assignTeacher(data = {}, user = {}) {
  const courseId = normalizePositiveId(data.courseId || data.course_id);
  const teacherUserId = normalizePositiveId(
    data.teacherUserId || data.teacher_user_id,
  );
  const course = await getCourse(courseId);
  if (!course) throw new Error("Course not found.");
  if (!canManageTeacherAssignments(user, course)) {
    throw new Error("You cannot assign teachers to this course.");
  }

  const teacherResult = await query(
    `SELECT id, school_id, full_name
     FROM users
     WHERE id = $1 AND role = 'teacher' AND is_active = true`,
    [teacherUserId],
  );
  const teacher = teacherResult.rows[0];
  if (!teacher || Number(teacher.school_id) !== Number(course.school_id)) {
    throw new Error("Choose an active teacher from this school.");
  }

  const result = await query(
    `INSERT INTO course_teacher_assignments (
       course_id, teacher_user_id, assigned_by_user_id, notes, is_active,
       assigned_at, deallocated_at, updated_at
     )
     VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT (course_id, teacher_user_id)
     DO UPDATE SET
       assigned_by_user_id = EXCLUDED.assigned_by_user_id,
       notes = EXCLUDED.notes,
       is_active = true,
       assigned_at = CURRENT_TIMESTAMP,
       deallocated_at = NULL,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [courseId, teacherUserId, user.userId, data.notes || null],
  );

  await notificationsService.notifyUser(teacherUserId, {
    title: "Course assigned",
    message: `${course.name} is now assigned to you.`,
    notification_type: "teacher_course_assigned",
    entity_type: "course",
    entity_id: courseId,
  });
  return result.rows[0];
}

async function deallocateTeacher(assignmentId, user = {}) {
  const result = await query(
    `SELECT cta.*, c.school_id, c.name AS course_name
     FROM course_teacher_assignments cta
     JOIN courses c ON c.id = cta.course_id
     WHERE cta.id = $1`,
    [assignmentId],
  );
  const assignment = result.rows[0];
  if (!assignment) return null;
  if (!canManageTeacherAssignments(user, assignment)) {
    throw new Error("You cannot deallocate this teacher.");
  }
  const updated = await query(
    `UPDATE course_teacher_assignments
     SET is_active = false,
         deallocated_at = COALESCE(deallocated_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [assignmentId],
  );
  return updated.rows[0];
}

async function requestTemplateUpdate(courseId, user = {}) {
  await assertTeacherCourseAccess(user, courseId);
  const course = await query(
    `SELECT c.id, c.name, c.template_id, t.version AS current_template_version,
            u.full_name AS teacher_name
     FROM courses c
     LEFT JOIN course_templates t ON t.id = c.template_id
     JOIN users u ON u.id = $3
     WHERE c.id = $1 AND c.school_id = $2`,
    [courseId, user.schoolId, user.userId],
  );
  const row = course.rows[0];
  if (!row?.template_id || !row.current_template_version) {
    throw new Error("This course has no template update.");
  }
  const result = await query(
    `INSERT INTO course_update_requests (
       course_id, teacher_user_id, template_version
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (course_id, teacher_user_id, template_version)
     DO NOTHING
     RETURNING *`,
    [courseId, user.userId, row.current_template_version],
  );
  const request =
    result.rows[0] ||
    (
      await query(
        `SELECT *
         FROM course_update_requests
         WHERE course_id = $1
           AND teacher_user_id = $2
           AND template_version = $3`,
        [courseId, user.userId, row.current_template_version],
      )
    ).rows[0];
  if (result.rows[0]) {
    await notificationsService.notifyRole("school_admin", {
      school_id: user.schoolId,
      title: "Course update review requested",
      message: `${row.teacher_name || "A teacher"} asked you to review the update for ${row.name}.`,
      notification_type: "course_update_requested",
      entity_type: "course",
      entity_id: courseId,
    });
  }
  return request;
}

module.exports = {
  normalizePositiveId,
  teacherRequiresAssignment,
  canManageTeacherAssignments,
  listTeacherAssignments,
  assignTeacher,
  deallocateTeacher,
  isTeacherAssignedToCourse,
  assertTeacherCourseAccess,
  listTeacherCourseIds,
  assertTeacherLearnerAccess,
  requestTemplateUpdate,
};
