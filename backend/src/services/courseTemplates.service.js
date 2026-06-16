const { query } = require("../config");
const notificationsService = require("./notifications.service");
const {
  buildTemplateLearningOverview,
  buildTemplateModuleLearning,
} = require("./courseTemplatePreview");
const { sanitizeActivityContent } = require("../utils/richTextSanitizer");

function normalizeCourseCategory(category) {
  if (["general", "weekly_typing", "weekly_quiz"].includes(category)) {
    return category;
  }
  return "general";
}

function isSystemAdmin(user = {}) {
  return user.role === "system_admin";
}

function isSchoolStaff(user = {}) {
  return ["school_admin", "teacher"].includes(user.role);
}

function requireSchool(user = {}) {
  if (!isSchoolStaff(user) || !user.schoolId) {
    throw new Error("School staff account is required.");
  }
}

async function notifyTemplateUpdate(templateId, templateVersion) {
  const schools = await query(
    `SELECT DISTINCT c.school_id, t.name
     FROM courses c
     JOIN course_templates t ON t.id = c.template_id
     WHERE c.template_id = $1
       AND c.school_id IS NOT NULL
       AND COALESCE(c.template_version, 0) < $2`,
    [templateId, templateVersion],
  );

  for (const school of schools.rows) {
    const inserted = await query(
      `INSERT INTO template_update_notifications (
         template_id, school_id, template_version
       )
       VALUES ($1, $2, $3)
       ON CONFLICT (template_id, school_id, template_version) DO NOTHING
       RETURNING id`,
      [templateId, school.school_id, templateVersion],
    );

    if (!inserted.rows[0]) continue;

    await notificationsService.notifyRole("school_admin", {
      school_id: school.school_id,
      title: "Course template updated",
      message: `${school.name} has template version ${templateVersion} available. Sync it into your school course when ready.`,
      notification_type: "course_template_updated",
      entity_type: "course_template",
      entity_id: templateId,
    });
  }
}

async function bumpTemplateVersion(templateId) {
  const result = await query(
    `UPDATE course_templates
     SET version = COALESCE(version, 1) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, version`,
    [templateId],
  );
  if (result.rows[0]) {
    await notifyTemplateUpdate(result.rows[0].id, result.rows[0].version);
  }
  return result.rows[0];
}

async function getTemplateIdForModule(templateModuleId) {
  const result = await query(
    "SELECT template_id FROM course_template_modules WHERE id = $1",
    [templateModuleId],
  );
  return result.rows[0]?.template_id;
}

async function getTemplateIdForActivity(templateActivityId) {
  const result = await query(
    `SELECT tm.template_id
     FROM course_template_activities ta
     JOIN course_template_modules tm ON tm.id = ta.template_module_id
     WHERE ta.id = $1`,
    [templateActivityId],
  );
  return result.rows[0]?.template_id;
}

async function listTemplates(filters = {}, user = {}) {
  const params = [];
  const schoolId = user.schoolId || null;
  let sql = "SELECT t.*";

  if (isSchoolStaff(user) && schoolId) {
    params.push(schoolId);
    sql += `, c.id AS adopted_course_id,
            c.template_version AS adopted_template_version,
            c.school_version AS adopted_school_version,
            (c.id IS NOT NULL) AS is_adopted,
            (c.id IS NOT NULL AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)) AS update_available`;
  }

  sql += " FROM course_templates t";

  if (isSchoolStaff(user) && schoolId) {
    sql += ` LEFT JOIN courses c
              ON c.template_id = t.id
             AND c.school_id = $1`;
  }

  sql += " WHERE 1=1";

  if (!isSystemAdmin(user)) {
    sql += " AND t.is_active = true";
  }

  if (filters.category && filters.category !== "all") {
    params.push(filters.category);
    sql += ` AND t.course_category = $${params.length}`;
  }

  sql += " ORDER BY t.course_category, t.name";
  const result = await query(sql, params);
  return result.rows;
}

async function createTemplate(data = {}) {
  const result = await query(
    `INSERT INTO course_templates (
       name, code, description, target_level, image_url, estimated_weeks,
       learning_objectives, certificate_enabled, course_category, is_active
     )
     VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.code || null,
      data.description || "",
      data.target_level || null,
      data.image_url || null,
      data.estimated_weeks || null,
      JSON.stringify(data.learning_objectives || []),
      data.certificate_enabled === true,
      normalizeCourseCategory(data.course_category),
      data.is_active !== false,
    ],
  );
  return result.rows[0];
}

async function updateTemplate(templateId, data = {}) {
  const result = await query(
    `UPDATE course_templates
     SET name = $1,
         code = NULLIF($2, ''),
         description = $3,
         target_level = NULLIF($4, ''),
         image_url = NULLIF($5, ''),
         estimated_weeks = $6,
         learning_objectives = $7,
         certificate_enabled = $8,
         course_category = $9,
         is_active = $10,
         version = COALESCE(version, 1) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
      data.name,
      data.code || null,
      data.description || "",
      data.target_level || null,
      data.image_url || null,
      data.estimated_weeks || null,
      JSON.stringify(data.learning_objectives || []),
      data.certificate_enabled === true,
      normalizeCourseCategory(data.course_category),
      data.is_active !== false,
      templateId,
    ],
  );
  if (result.rows[0]) {
    await notifyTemplateUpdate(templateId, result.rows[0].version);
  }
  return result.rows[0];
}

async function getTemplateBuilder(templateId) {
  const templateResult = await query(
    "SELECT * FROM course_templates WHERE id = $1",
    [templateId],
  );
  const template = templateResult.rows[0];
  if (!template) return null;

  const rows = await query(
    `SELECT
       tm.id AS module_id,
       tm.title AS module_title,
       tm.description AS module_description,
       tm.learning_outcomes,
       tm.position AS module_position,
       tm.is_published AS module_published,
       tm.unlock_at,
       ta.id AS activity_id,
       ta.title AS activity_title,
       ta.activity_type,
       ta.content,
       ta.points,
       ta.position AS activity_position,
       ta.is_required,
       COALESCE(ta.availability_mode, 'required') AS availability_mode,
       ta.completion_rule,
       ta.pass_score,
       ta.is_published AS activity_published
     FROM course_template_modules tm
     LEFT JOIN course_template_activities ta ON ta.template_module_id = tm.id
     WHERE tm.template_id = $1
     ORDER BY tm.position, ta.position`,
    [templateId],
  );

  const modules = new Map();
  rows.rows.forEach((row) => {
    if (!modules.has(row.module_id)) {
      modules.set(row.module_id, {
        id: row.module_id,
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
      modules.get(row.module_id).activities.push({
        id: row.activity_id,
        title: row.activity_title,
        activity_type: row.activity_type,
        content: row.content || {},
        points: Number(row.points || 0),
        position: row.activity_position,
        is_required: row.is_required,
        availability_mode: row.availability_mode,
        completion_rule: row.completion_rule,
        pass_score: row.pass_score,
        is_published: row.activity_published,
      });
    }
  });

  return { template, modules: [...modules.values()] };
}

async function getTemplateLearningOverview(templateId) {
  return buildTemplateLearningOverview(await getTemplateBuilder(templateId));
}

async function getTemplateModuleLearning(templateId, moduleId) {
  return buildTemplateModuleLearning(
    await getTemplateBuilder(templateId),
    moduleId,
  );
}

async function createTemplateModule(templateId, data = {}) {
  const result = await query(
    `INSERT INTO course_template_modules (
       template_id, title, description, learning_outcomes, position, is_published, unlock_at
     )
     VALUES (
       $1, $2, $3, $4,
       COALESCE($5, (SELECT COALESCE(MAX(position), 0) + 1 FROM course_template_modules WHERE template_id = $1)),
       $6, NULLIF($7, '')::timestamp
     )
     RETURNING *`,
    [
      templateId,
      data.title,
      data.description || "",
      JSON.stringify(data.learning_outcomes || []),
      data.position || null,
      data.is_published !== false,
      data.unlock_at || null,
    ],
  );
  await bumpTemplateVersion(templateId);
  return result.rows[0];
}

async function updateTemplateModule(moduleId, data = {}) {
  const templateId = await getTemplateIdForModule(moduleId);
  const result = await query(
    `UPDATE course_template_modules
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
  if (templateId) await bumpTemplateVersion(templateId);
  return result.rows[0];
}

async function createTemplateActivity(moduleId, data = {}) {
  const safeContent = sanitizeActivityContent(data.content || {});
  const result = await query(
    `INSERT INTO course_template_activities (
       template_module_id, title, activity_type, content, points, position,
       is_required, availability_mode, completion_rule, pass_score, is_published
     )
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE($6, (SELECT COALESCE(MAX(position), 0) + 1 FROM course_template_activities WHERE template_module_id = $1)),
       $7, $8, $9, $10, $11
     )
     RETURNING *`,
    [
      moduleId,
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(safeContent),
      data.points || 0,
      data.position || null,
      data.is_required !== false,
      data.availability_mode === "try_more" ? "try_more" : "required",
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
    ],
  );
  const templateId = await getTemplateIdForModule(moduleId);
  if (templateId) await bumpTemplateVersion(templateId);
  return result.rows[0];
}

async function updateTemplateActivity(activityId, data = {}) {
  const templateId = await getTemplateIdForActivity(activityId);
  const safeContent = sanitizeActivityContent(data.content || {});
  const result = await query(
    `UPDATE course_template_activities
     SET title = $1,
         activity_type = $2,
         content = $3,
         points = $4,
         position = $5,
         is_required = $6,
         availability_mode = $7,
         completion_rule = $8,
         pass_score = $9,
         is_published = $10,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11
     RETURNING *`,
    [
      data.title,
      data.activity_type || "lesson",
      JSON.stringify(safeContent),
      data.points || 0,
      data.position || 1,
      data.is_required !== false,
      data.availability_mode === "try_more" ? "try_more" : "required",
      data.completion_rule || "manual",
      data.pass_score || null,
      data.is_published !== false,
      activityId,
    ],
  );
  if (templateId) await bumpTemplateVersion(templateId);
  return result.rows[0];
}

async function deleteTemplateModule(moduleId) {
  const templateId = await getTemplateIdForModule(moduleId);
  await query("DELETE FROM course_template_modules WHERE id = $1", [moduleId]);
  if (templateId) await bumpTemplateVersion(templateId);
}

async function deleteTemplateActivity(activityId) {
  const templateId = await getTemplateIdForActivity(activityId);
  await query("DELETE FROM course_template_activities WHERE id = $1", [
    activityId,
  ]);
  if (templateId) await bumpTemplateVersion(templateId);
}

async function copyActivities(templateModuleId, schoolModuleId) {
  const activities = await query(
    `SELECT *
     FROM course_template_activities
     WHERE template_module_id = $1
     ORDER BY position`,
    [templateModuleId],
  );

  for (const activity of activities.rows) {
    await query(
      `INSERT INTO learning_activities (
         module_id, template_activity_id, title, activity_type, content, points,
         position, is_required, availability_mode, completion_rule, pass_score, is_published
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (module_id, position) DO NOTHING`,
      [
        schoolModuleId,
        activity.id,
        activity.title,
        activity.activity_type,
        JSON.stringify(activity.content || {}),
        activity.points || 0,
        activity.position,
        activity.is_required,
        activity.availability_mode || "required",
        activity.completion_rule,
        activity.pass_score,
        activity.is_published,
      ],
    );
  }
}

async function adoptTemplate(templateId, user = {}) {
  requireSchool(user);

  const existing = await query(
    `SELECT *
     FROM courses
     WHERE school_id = $1
       AND template_id = $2
     LIMIT 1`,
    [user.schoolId, templateId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const templateResult = await query(
    "SELECT * FROM course_templates WHERE id = $1 AND is_active = true",
    [templateId],
  );
  const template = templateResult.rows[0];
  if (!template) throw new Error("Template not found or inactive.");

  const courseResult = await query(
    `INSERT INTO courses (
       school_id, template_id, template_version, last_template_sync_at,
       school_version, name, code, description, target_level, image_url, estimated_weeks,
       learning_objectives, certificate_enabled, course_category, is_active
     )
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
     RETURNING *`,
    [
      user.schoolId,
      template.id,
      template.version,
      template.name,
      template.code,
      template.description,
      template.target_level,
      template.image_url,
      template.estimated_weeks,
      JSON.stringify(template.learning_objectives || []),
      template.certificate_enabled,
      template.course_category,
    ],
  );
  const course = courseResult.rows[0];

  const modules = await query(
    `SELECT *
     FROM course_template_modules
     WHERE template_id = $1
     ORDER BY position`,
    [templateId],
  );

  for (const module of modules.rows) {
    const schoolModule = await query(
      `INSERT INTO course_modules (
         course_id, template_module_id, title, description, learning_outcomes,
         position, is_published, unlock_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        course.id,
        module.id,
        module.title,
        module.description,
        JSON.stringify(module.learning_outcomes || []),
        module.position,
        module.is_published,
        module.unlock_at,
      ],
    );
    await copyActivities(module.id, schoolModule.rows[0].id);
  }

  return course;
}

async function getSchoolCourse(courseId, user = {}) {
  requireSchool(user);
  const result = await query(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available
     FROM courses c
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE c.id = $1
       AND c.school_id = $2`,
    [courseId, user.schoolId],
  );
  return result.rows[0];
}

async function syncSchoolCourse(courseId, user = {}) {
  const course = await getSchoolCourse(courseId, user);
  if (!course?.template_id)
    throw new Error("This course is not linked to a template.");

  const template = await query("SELECT * FROM course_templates WHERE id = $1", [
    course.template_id,
  ]);
  const templateRow = template.rows[0];
  if (!templateRow) throw new Error("Template no longer exists.");

  await query(
    `UPDATE courses
     SET name = $1,
         code = $2,
         description = $3,
         target_level = $4,
         image_url = $5,
         estimated_weeks = $6,
         learning_objectives = $7,
         certificate_enabled = $8,
         course_category = $9,
         template_version = $10,
         school_version = COALESCE(school_version, 1) + 1,
         last_template_sync_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11`,
    [
      templateRow.name,
      templateRow.code,
      templateRow.description,
      templateRow.target_level,
      templateRow.image_url,
      templateRow.estimated_weeks,
      JSON.stringify(templateRow.learning_objectives || []),
      templateRow.certificate_enabled,
      templateRow.course_category,
      templateRow.version,
      courseId,
    ],
  );

  const templateModules = await query(
    "SELECT * FROM course_template_modules WHERE template_id = $1 ORDER BY position",
    [course.template_id],
  );

  for (const templateModule of templateModules.rows) {
    let schoolModule = await query(
      `UPDATE course_modules
       SET title = $1,
           description = $2,
           learning_outcomes = $3,
           is_published = $4,
           unlock_at = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE course_id = $6
         AND template_module_id = $7
       RETURNING *`,
      [
        templateModule.title,
        templateModule.description,
        JSON.stringify(templateModule.learning_outcomes || []),
        templateModule.is_published,
        templateModule.unlock_at,
        courseId,
        templateModule.id,
      ],
    );

    if (!schoolModule.rows[0]) {
      schoolModule = await query(
        `INSERT INTO course_modules (
           course_id, template_module_id, title, description, learning_outcomes,
           position, is_published, unlock_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           CASE
             WHEN EXISTS (SELECT 1 FROM course_modules WHERE course_id = $1 AND position = $6)
             THEN (SELECT COALESCE(MAX(position), 0) + 1 FROM course_modules WHERE course_id = $1)
             ELSE $6
           END,
           $7, $8
         )
         RETURNING *`,
        [
          courseId,
          templateModule.id,
          templateModule.title,
          templateModule.description,
          JSON.stringify(templateModule.learning_outcomes || []),
          templateModule.position,
          templateModule.is_published,
          templateModule.unlock_at,
        ],
      );
    }

    const templateActivities = await query(
      `SELECT *
       FROM course_template_activities
       WHERE template_module_id = $1
       ORDER BY position`,
      [templateModule.id],
    );

    for (const templateActivity of templateActivities.rows) {
      const updated = await query(
        `UPDATE learning_activities
         SET title = $1,
             activity_type = $2,
             content = $3,
             points = $4,
             is_required = $5,
             availability_mode = $6,
             completion_rule = $7,
             pass_score = $8,
             is_published = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE module_id = $10
           AND template_activity_id = $11
         RETURNING *`,
        [
          templateActivity.title,
          templateActivity.activity_type,
          JSON.stringify(templateActivity.content || {}),
          templateActivity.points,
          templateActivity.is_required,
          templateActivity.availability_mode || "required",
          templateActivity.completion_rule,
          templateActivity.pass_score,
          templateActivity.is_published,
          schoolModule.rows[0].id,
          templateActivity.id,
        ],
      );

      if (!updated.rows[0]) {
        await query(
          `INSERT INTO learning_activities (
             module_id, template_activity_id, title, activity_type, content, points,
             position, is_required, availability_mode, completion_rule, pass_score, is_published
           )
           VALUES (
             $1, $2, $3, $4, $5, $6,
             CASE
               WHEN EXISTS (SELECT 1 FROM learning_activities WHERE module_id = $1 AND position = $7)
               THEN (SELECT COALESCE(MAX(position), 0) + 1 FROM learning_activities WHERE module_id = $1)
               ELSE $7
             END,
             $8, $9, $10, $11, $12
           )`,
          [
            schoolModule.rows[0].id,
            templateActivity.id,
            templateActivity.title,
            templateActivity.activity_type,
            JSON.stringify(templateActivity.content || {}),
            templateActivity.points,
            templateActivity.position,
            templateActivity.is_required,
            templateActivity.availability_mode || "required",
            templateActivity.completion_rule,
            templateActivity.pass_score,
            templateActivity.is_published,
          ],
        );
      }
    }
  }

  return getSchoolCourse(courseId, user);
}

async function rollbackSchoolCourse(courseId, user = {}) {
  const course = await getSchoolCourse(courseId, user);
  if (!course?.template_id) throw new Error("This course is not linked to a template.");

  await query(
    `DELETE FROM learning_activities la
     USING course_modules cm
     WHERE la.module_id = cm.id
       AND cm.course_id = $1
       AND la.template_activity_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM course_template_activities ta
         WHERE ta.id = la.template_activity_id
       )`,
    [courseId]
  );

  await query(
    `DELETE FROM course_modules cm
     WHERE cm.course_id = $1
       AND cm.template_module_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM course_template_modules tm
         WHERE tm.id = cm.template_module_id
       )`,
    [courseId]
  );

  return syncSchoolCourse(courseId, user);
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  getTemplateBuilder,
  getTemplateLearningOverview,
  getTemplateModuleLearning,
  createTemplateModule,
  updateTemplateModule,
  deleteTemplateModule,
  createTemplateActivity,
  updateTemplateActivity,
  deleteTemplateActivity,
  adoptTemplate,
  getSchoolCourse,
  syncSchoolCourse,
  rollbackSchoolCourse,
};
