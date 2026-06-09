const { query } = require("../config");
const courseTemplatesService = require("./courseTemplates.service");

function normalizeCourseCategory(category) {
  if (["general", "weekly_typing", "weekly_quiz"].includes(category)) {
    return category;
  }
  return "general";
}

async function getAllCourses(filters = {}) {
  const category =
    filters.category === "all"
      ? null
      : normalizeCourseCategory(filters.category);
  const params = [];
  let categorySql = "";

  if (category) {
    params.push(category);
    categorySql = ` AND c.course_category = $${params.length}`;
  }

  let scopeSql = "";
  if (
    filters.user?.role === "school_admin" ||
    filters.user?.role === "teacher"
  ) {
    params.push(filters.user.schoolId);
    scopeSql = ` AND c.school_id = $${params.length}`;
  } else if (filters.user?.role === "learner") {
    params.push(filters.user.userId);
    scopeSql = ` AND EXISTS (
      SELECT 1
      FROM course_allocations a
      JOIN learners l ON l.id = a.learner_id
      WHERE a.course_id = c.id
        AND l.user_id = $${params.length}
        AND a.status IN ('active', 'in_progress', 'completed')
    )`;
  } else if (filters.school_id) {
    params.push(filters.school_id);
    scopeSql = ` AND c.school_id = $${params.length}`;
  }

  const result = await query(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available
     FROM courses c
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE 1=1
       ${categorySql}
       ${scopeSql}
     ORDER BY c.course_category, c.name`,
    params,
  );
  return result.rows;
}

async function createCourse(courseData) {
  const {
    name,
    description,
    school_id,
    code,
    target_level,
    image_url,
    estimated_weeks,
    learning_objectives,
    certificate_enabled,
    is_active,
  } = courseData;
  const courseCategory = normalizeCourseCategory(courseData.course_category);

  const result = await query(
    `INSERT INTO courses (
       school_id, name, code, description, target_level, image_url,
       estimated_weeks, learning_objectives, certificate_enabled,
       course_category, is_active
     )
     VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NULLIF($6, ''),
             $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      school_id || null,
      name,
      code || null,
      description,
      target_level || null,
      image_url || null,
      estimated_weeks || null,
      JSON.stringify(learning_objectives || []),
      certificate_enabled === true,
      courseCategory,
      is_active !== false,
    ],
  );
  return result.rows[0];
}

async function getCourseById(id) {
  const result = await query(
    `SELECT c.*
     FROM courses c
     WHERE c.id = $1
       `,
    [id],
  );
  return result.rows[0];
}

async function updateCourse(id, courseData) {
  const {
    name,
    description,
    school_id,
    code,
    target_level,
    image_url,
    estimated_weeks,
    learning_objectives,
    certificate_enabled,
    is_active,
  } = courseData;
  const courseCategory = normalizeCourseCategory(courseData.course_category);

  const result = await query(
    `UPDATE courses c
     SET school_id = $1,
         name = $2,
         code = NULLIF($3, ''),
         description = $4,
         target_level = NULLIF($5, ''),
         image_url = NULLIF($6, ''),
         estimated_weeks = $7,
         learning_objectives = $8,
         certificate_enabled = $9,
         course_category = $10,
         is_active = $11,
         updated_at = CURRENT_TIMESTAMP
     WHERE c.id = $12
     RETURNING *`,
    [
      school_id || null,
      name,
      code || null,
      description,
      target_level || null,
      image_url || null,
      estimated_weeks || null,
      JSON.stringify(learning_objectives || []),
      certificate_enabled === true,
      courseCategory,
      is_active !== false,
      id,
    ],
  );
  return result.rows[0];
}

async function deleteCourse(id) {
  await query(
    `DELETE FROM courses c
     WHERE c.id = $1`,
    [id],
  );
}

async function findLearnerForUser(userId) {
  const result = await query(
    "SELECT * FROM learners WHERE user_id = $1 AND is_active = true LIMIT 1",
    [userId],
  );
  return result.rows[0];
}

function isStaff(user = {}) {
  return ["system_admin", "school_admin", "teacher"].includes(user.role);
}

function isSchoolStaff(user = {}) {
  return ["school_admin", "teacher"].includes(user.role);
}

async function assertCourseManageAccess(courseId, user = {}) {
  if (user.role === "system_admin") return true;
  if (!isSchoolStaff(user) || !user.schoolId) return false;

  const result = await query(
    "SELECT id FROM courses WHERE id = $1 AND school_id = $2",
    [courseId, user.schoolId],
  );
  return Boolean(result.rows[0]);
}

async function bumpSchoolCourseVersion(courseId) {
  await query(
    `UPDATE courses
     SET school_version = COALESCE(school_version, 1) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND school_id IS NOT NULL`,
    [courseId],
  );
}

function normalizeStatus(status) {
  const allowed = new Set([
    "not_started",
    "started",
    "in_progress",
    "submitted",
    "completed",
    "graded",
  ]);
  return allowed.has(status) ? status : "completed";
}

function activityDone(status) {
  return ["completed", "graded"].includes(status);
}

function moduleSummary(module) {
  const total = module.activities.length;
  const completed = module.activities.filter((activity) =>
    activityDone(activity.status),
  ).length;
  const scores = module.activities
    .map((activity) => Number(activity.score))
    .filter((score) => Number.isFinite(score));
  const score = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : Math.round((completed / Math.max(total, 1)) * 100);

  return {
    total_activities: total,
    completed_activities: completed,
    progress_percent: total ? Math.round((completed / total) * 100) : 0,
    score_percent: total ? score : 0,
    is_done: total > 0 && completed >= total,
  };
}

async function assertCourseAccess(courseId, user = {}) {
  if (isStaff(user)) {
    const result = await query(
      `SELECT c.*,
              t.version AS current_template_version,
              (
                c.template_id IS NOT NULL
                AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
              ) AS update_available
       FROM courses c
       LEFT JOIN course_templates t ON t.id = c.template_id
       WHERE c.id = $1`,
      [courseId],
    );
    return { course: result.rows[0], learner: null };
  }

  const learner = await findLearnerForUser(user.userId);
  if (!learner) return { course: null, learner: null };

  const result = await query(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available
     FROM courses c
     JOIN course_allocations a ON a.course_id = c.id
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE c.id = $1
       AND a.learner_id = $2
       AND a.status IN ('active', 'in_progress', 'completed')
     LIMIT 1`,
    [courseId, learner.id],
  );
  return { course: result.rows[0], learner };
}

async function getCourseLearningOverview(courseId, user = {}) {
  const { course, learner } = await assertCourseAccess(courseId, user);
  if (!course) return null;

  const staffView = isStaff(user);
  const params = [courseId];
  let learnerJoin = "AND ap.learner_id IS NULL";

  if (learner) {
    params.push(learner.id);
    learnerJoin = "AND ap.learner_id = $2";
  }

  params.push(staffView);
  const staffParam = `$${params.length}`;

  const result = await query(
    `SELECT
       cm.id AS module_id,
       cm.template_module_id,
       cm.title AS module_title,
       cm.description AS module_description,
       cm.learning_outcomes,
       cm.position AS module_position,
       cm.is_published AS module_published,
       cm.unlock_at,
       la.id AS activity_id,
       la.template_activity_id,
       la.title AS activity_title,
       la.activity_type,
       la.content,
       la.points,
       la.position AS activity_position,
       la.is_required,
       la.completion_rule,
       la.pass_score,
       la.is_published AS activity_published,
       COALESCE(ap.status, 'not_started') AS status,
       ap.score,
       ap.completed_at,
       ap.updated_at AS progress_updated_at
     FROM course_modules cm
     LEFT JOIN learning_activities la
       ON la.module_id = cm.id
      AND (la.is_published = true OR ${staffParam} = true)
     LEFT JOIN activity_progress ap
       ON ap.activity_id = la.id
      ${learnerJoin}
     WHERE cm.course_id = $1
       AND (cm.is_published = true OR ${staffParam} = true)
     ORDER BY cm.position, la.position`,
    params,
  );

  const moduleMap = new Map();
  result.rows.forEach((row) => {
    if (!moduleMap.has(row.module_id)) {
      moduleMap.set(row.module_id, {
        id: row.module_id,
        template_module_id: row.template_module_id,
        title: row.module_title,
        description: row.module_description,
        learning_outcomes: row.learning_outcomes || [],
        position: row.module_position,
        is_published: row.module_published,
        unlock_at: row.unlock_at,
        activities: [],
      });
    }

    if (row.activity_id) {
      moduleMap.get(row.module_id).activities.push({
        id: row.activity_id,
        template_activity_id: row.template_activity_id,
        title: row.activity_title,
        activity_type: row.activity_type,
        content: row.content || {},
        points: Number(row.points || 0),
        position: row.activity_position,
        is_required: row.is_required,
        completion_rule: row.completion_rule,
        pass_score: row.pass_score,
        is_published: row.activity_published,
        status: row.status,
        score: row.score === null ? null : Number(row.score),
        completed_at: row.completed_at,
        progress_updated_at: row.progress_updated_at,
      });
    }
  });

  const modules = [...moduleMap.values()].map((module) => ({
    ...module,
    ...moduleSummary(module),
  }));
  const completedModules = modules.filter((module) => module.is_done).length;
  const totalActivities = modules.reduce(
    (sum, module) => sum + module.total_activities,
    0,
  );
  const completedActivities = modules.reduce(
    (sum, module) => sum + module.completed_activities,
    0,
  );
  const courseScore = modules.length
    ? Math.round(
        modules.reduce((sum, module) => sum + module.score_percent, 0) /
          modules.length,
      )
    : 0;

  return {
    course,
    learner,
    modules,
    summary: {
      total_modules: modules.length,
      completed_modules: completedModules,
      total_activities: totalActivities,
      completed_activities: completedActivities,
      progress_percent: totalActivities
        ? Math.round((completedActivities / totalActivities) * 100)
        : 0,
      score_percent: courseScore,
      is_done: modules.length > 0 && completedModules >= modules.length,
    },
  };
}

async function getModuleLearning(courseId, moduleId, user = {}) {
  const overview = await getCourseLearningOverview(courseId, user);
  if (!overview) return null;

  const moduleIndex = overview.modules.findIndex(
    (module) => Number(module.id) === Number(moduleId),
  );
  if (moduleIndex === -1) return null;

  const module = overview.modules[moduleIndex];
  const nextModule = overview.modules[moduleIndex + 1] || null;
  const previousModule = overview.modules[moduleIndex - 1] || null;
  const isUnlocked =
    !module.unlock_at ||
    new Date(module.unlock_at).getTime() <= Date.now() ||
    isStaff(user);

  return {
    course: overview.course,
    learner: overview.learner,
    module,
    previous_module: previousModule
      ? {
          id: previousModule.id,
          title: previousModule.title,
          is_done: previousModule.is_done,
        }
      : null,
    next_module: nextModule
      ? {
          id: nextModule.id,
          title: nextModule.title,
          is_done: nextModule.is_done,
          is_open:
            !nextModule.unlock_at ||
            new Date(nextModule.unlock_at).getTime() <= Date.now() ||
            isStaff(user),
        }
      : null,
    course_summary: overview.summary,
    is_unlocked: isUnlocked,
  };
}

async function upsertActivityProgress(activityId, user = {}, data = {}) {
  const learner = await findLearnerForUser(user.userId);
  if (!learner)
    throw new Error("Learner profile is not linked to this account.");

  const access = await query(
    `SELECT la.id, la.points
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     JOIN course_allocations ca ON ca.course_id = cm.course_id
     WHERE la.id = $1
       AND ca.learner_id = $2
       AND ca.status IN ('active', 'in_progress', 'completed')
     LIMIT 1`,
    [activityId, learner.id],
  );

  if (!access.rows[0])
    throw new Error("Activity is not available to this learner.");

  const status = normalizeStatus(data.status);
  const score =
    data.score !== undefined && data.score !== null && data.score !== ""
      ? Math.max(0, Math.min(100, Number(data.score)))
      : status === "completed"
        ? 100
        : null;

  const result = await query(
    `INSERT INTO activity_progress (
       learner_id, activity_id, status, score, opened_at, completed_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, COALESCE($5, NOW()),
       CASE WHEN $3 IN ('completed', 'graded') THEN NOW() ELSE NULL END,
       NOW()
     )
     ON CONFLICT (learner_id, activity_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       score = COALESCE(EXCLUDED.score, activity_progress.score),
       opened_at = COALESCE(activity_progress.opened_at, NOW()),
       completed_at = CASE
         WHEN EXCLUDED.status IN ('completed', 'graded')
         THEN COALESCE(activity_progress.completed_at, NOW())
         ELSE activity_progress.completed_at
       END,
       updated_at = NOW()
     RETURNING *`,
    [learner.id, activityId, status, score, data.opened_at || null],
  );

  return result.rows[0];
}

async function createModule(courseId, data = {}) {
  const result = await query(
    `INSERT INTO course_modules (
       course_id, title, description, learning_outcomes, position, is_published, unlock_at
     )
     VALUES (
       $1, $2, $3, $4,
       COALESCE($5, (SELECT COALESCE(MAX(position), 0) + 1 FROM course_modules WHERE course_id = $1)),
       $6, NULLIF($7, '')::timestamp
     )
     RETURNING *`,
    [
      courseId,
      data.title,
      data.description || "",
      JSON.stringify(data.learning_outcomes || []),
      data.position || null,
      data.is_published !== false,
      data.unlock_at || null,
    ],
  );
  return result.rows[0];
}

async function createManagedModule(courseId, user = {}, data = {}) {
  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this course.");
  const module = await createModule(courseId, data);
  await bumpSchoolCourseVersion(courseId);
  return module;
}

async function updateModule(moduleId, user = {}, data = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId],
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) return null;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this module.");

  const result = await query(
    `UPDATE course_modules
     SET title = $1,
         description = $2,
         learning_outcomes = $3,
         position = $4,
         is_published = $5,
         unlock_at = NULLIF($6, '')::timestamp,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [
      data.title,
      data.description || "",
      JSON.stringify(data.learning_outcomes || []),
      data.position || 1,
      data.is_published !== false,
      data.unlock_at || null,
      moduleId,
    ],
  );
  await bumpSchoolCourseVersion(courseId);
  return result.rows[0];
}

async function deleteModule(moduleId, user = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId],
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) return;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot delete this module.");

  await query("DELETE FROM course_modules WHERE id = $1", [moduleId]);
  await bumpSchoolCourseVersion(courseId);
}

async function createActivity(moduleId, data = {}) {
  const result = await query(
    `INSERT INTO learning_activities (
       module_id, title, activity_type, content, points, position,
       is_required, completion_rule, pass_score, is_published
     )
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE($6, (SELECT COALESCE(MAX(position), 0) + 1 FROM learning_activities WHERE module_id = $1)),
       $7, $8, $9, $10
     )
     RETURNING *`,
    [
      moduleId,
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(data.content || {}),
      data.points || 0,
      data.position || null,
      data.is_required !== false,
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
    ],
  );
  return result.rows[0];
}

async function createManagedActivity(moduleId, user = {}, data = {}) {
  const moduleCourse = await query(
    "SELECT course_id FROM course_modules WHERE id = $1",
    [moduleId],
  );
  const courseId = moduleCourse.rows[0]?.course_id;
  if (!courseId) throw new Error("Module not found.");

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this module.");

  const activity = await createActivity(moduleId, data);
  await bumpSchoolCourseVersion(courseId);
  return activity;
}

async function updateActivity(activityId, user = {}, data = {}) {
  const activityCourse = await query(
    `SELECT cm.course_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     WHERE la.id = $1`,
    [activityId],
  );
  const courseId = activityCourse.rows[0]?.course_id;
  if (!courseId) return null;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot edit this activity.");

  const result = await query(
    `UPDATE learning_activities
     SET title = $1,
         activity_type = $2,
         content = $3,
         points = $4,
         position = $5,
         is_required = $6,
         completion_rule = $7,
         pass_score = $8,
         is_published = $9,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING *`,
    [
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(data.content || {}),
      data.points || 0,
      data.position || 1,
      data.is_required !== false,
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
      activityId,
    ],
  );
  await bumpSchoolCourseVersion(courseId);
  return result.rows[0];
}

async function deleteActivity(activityId, user = {}) {
  const activityCourse = await query(
    `SELECT cm.course_id
     FROM learning_activities la
     JOIN course_modules cm ON cm.id = la.module_id
     WHERE la.id = $1`,
    [activityId],
  );
  const courseId = activityCourse.rows[0]?.course_id;
  if (!courseId) return;

  const allowed = await assertCourseManageAccess(courseId, user);
  if (!allowed) throw new Error("You cannot delete this activity.");

  await query("DELETE FROM learning_activities WHERE id = $1", [activityId]);
  await bumpSchoolCourseVersion(courseId);
}

module.exports = {
  getAllCourses,
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  normalizeCourseCategory,
  getCourseLearningOverview,
  getModuleLearning,
  upsertActivityProgress,
  createModule,
  createManagedModule,
  updateModule,
  deleteModule,
  createActivity,
  createManagedActivity,
  updateActivity,
  deleteActivity,
  syncSchoolCourse: courseTemplatesService.syncSchoolCourse,
  rollbackSchoolCourse: courseTemplatesService.rollbackSchoolCourse,
};
