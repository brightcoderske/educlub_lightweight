const { query } = require("../config");
const notificationsService = require("./notifications.service");
const {
  buildTemplateLearningOverview,
  buildTemplateModuleLearning,
} = require("./courseTemplatePreview");
const { sanitizeActivityContent } = require("../utils/richTextSanitizer");
const { withTransaction } = require("../database/transaction");
const {
  claimRow,
  freePosition,
  differingFields,
  isArchived,
  MODULE_FIELDS,
  ACTIVITY_FIELDS,
} = require("./courseSync");

function normalizeCourseCategory(category) {
  const normalized = String(category || "general")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return normalized || "general";
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
             AND c.school_id = $1
             AND c.deleted_at IS NULL`;
  }

  sql += " WHERE t.deleted_at IS NULL";

  if (!isSystemAdmin(user)) {
    sql += " AND COALESCE(t.is_active, true) = true";
  }

  if (filters.category === "standard") {
    sql += " AND t.course_category NOT IN ('weekly_typing', 'weekly_quiz')";
  } else if (filters.category && filters.category !== "all") {
    params.push(normalizeCourseCategory(filters.category));
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
       learning_objectives, certificate_enabled, independent_price_amount,
       independent_currency, course_category, is_active
     )
     VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, $8, $9, $10, $11, $12)
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
      Number(data.independent_price_amount || 0),
      data.independent_currency || "KES",
      normalizeCourseCategory(data.course_category),
      data.is_active === true,
    ],
  );
  return result.rows[0];
}

async function updateTemplate(templateId, data = {}) {
  const currentResult = await query(
    "SELECT * FROM course_templates WHERE id = $1 AND deleted_at IS NULL",
    [templateId],
  );
  const current = currentResult.rows[0];
  if (!current) return null;
  const next = { ...current, ...data };

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
         independent_price_amount = $9,
         independent_currency = $10,
         course_category = $11,
         is_active = $12,
         version = COALESCE(version, 1) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13
       AND deleted_at IS NULL
     RETURNING *`,
    [
      next.name,
      next.code || null,
      next.description || "",
      next.target_level || null,
      next.image_url || null,
      next.estimated_weeks || null,
      JSON.stringify(next.learning_objectives || []),
      next.certificate_enabled === true,
      Number(next.independent_price_amount || 0),
      next.independent_currency || "KES",
      normalizeCourseCategory(next.course_category),
      next.is_active !== false,
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
    "SELECT * FROM course_templates WHERE id = $1 AND deleted_at IS NULL",
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
  if (!data.skip_version_bump) await bumpTemplateVersion(templateId);
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
  if (templateId && !data.skip_version_bump) await bumpTemplateVersion(templateId);
  return result.rows[0];
}

async function deleteTemplate(templateId) {
  const result = await query(
    `UPDATE course_templates
     SET is_active = false,
         deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND deleted_at IS NULL`,
    [templateId],
  );
  return result.rowCount > 0;
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

async function reorderTemplateActivities(moduleId, activityIds = []) {
  const templateId = await getTemplateIdForModule(moduleId);
  if (!templateId) throw new Error("Module not found.");

  const orderedIds = (Array.isArray(activityIds) ? activityIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!orderedIds.length) throw new Error("Activity order is required.");

  const existing = await query(
    `SELECT id
     FROM course_template_activities
     WHERE template_module_id = $1::integer
       AND id = ANY($2::integer[])`,
    [moduleId, orderedIds],
  );
  if (existing.rows.length !== orderedIds.length) {
    throw new Error("Activity order contains an item outside this module.");
  }

  await query(
    `UPDATE course_template_activities
     SET position = -100000 - position
     WHERE template_module_id = $1::integer
       AND id = ANY($2::integer[])`,
    [moduleId, orderedIds],
  );

  for (const [index, activityId] of orderedIds.entries()) {
    await query(
      `UPDATE course_template_activities
       SET position = $1::integer,
           updated_at = CURRENT_TIMESTAMP
       WHERE template_module_id = $2::integer
         AND id = $3::integer`,
      [index + 1, moduleId, activityId],
    );
  }

  if (templateId) await bumpTemplateVersion(templateId);

  const result = await query(
    `SELECT *
     FROM course_template_activities
     WHERE template_module_id = $1::integer
     ORDER BY position`,
    [moduleId],
  );
  return result.rows;
}

async function countTemplates() {
  const result = await query(
    `SELECT COUNT(*) AS count
     FROM course_templates
     WHERE deleted_at IS NULL
       AND COALESCE(course_category, 'general') NOT IN ('weekly_typing', 'weekly_quiz')`,
  );
  return Number(result.rows[0]?.count || 0);
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
       AND deleted_at IS NULL
     LIMIT 1`,
    [user.schoolId, templateId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const templateResult = await query(
    "SELECT * FROM course_templates WHERE id = $1 AND is_active = true AND deleted_at IS NULL",
    [templateId],
  );
  const template = templateResult.rows[0];
  if (!template) throw new Error("Template not found or inactive.");

  const courseResult = await query(
    `INSERT INTO courses (
       school_id, template_id, template_version, last_template_sync_at,
       school_version, name, code, description, target_level, image_url, estimated_weeks,
       learning_objectives, certificate_enabled, independent_price_amount,
       independent_currency, course_category, is_active
     )
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
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
      Number(template.independent_price_amount || 0),
      template.independent_currency || "KES",
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

async function getSchoolCourse(courseId, user = {}, runQuery = query) {
  requireSchool(user);
  const result = await runQuery(
    `SELECT c.*,
            t.version AS current_template_version,
            (
              c.template_id IS NOT NULL
              AND COALESCE(c.template_version, 0) < COALESCE(t.version, 1)
            ) AS update_available
     FROM courses c
     LEFT JOIN course_templates t ON t.id = c.template_id
     WHERE c.id = $1
       AND c.school_id = $2
       AND c.deleted_at IS NULL`,
    [courseId, user.schoolId],
  );
  return result.rows[0];
}

async function applySync(courseId, user, runQuery) {
  const course = await getSchoolCourse(courseId, user, runQuery);
  if (!course || !course.template_id)
    throw new Error("This course is not linked to a template.");

  const template = await runQuery(
    "SELECT * FROM course_templates WHERE id = $1 AND deleted_at IS NULL",
    [course.template_id],
  );
  const templateRow = template.rows[0];
  if (!templateRow) throw new Error("Template no longer exists.");

  await runQuery(
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

  const templateModules = await runQuery(
    "SELECT * FROM course_template_modules WHERE template_id = $1 ORDER BY position",
    [course.template_id],
  );
  const schoolModules = await runQuery(
    "SELECT * FROM course_modules WHERE course_id = $1",
    [courseId],
  );

  const summary = {
    modules: { added: 0, updated: 0, unchanged: 0, relinked: 0 },
    activities: { added: 0, updated: 0, unchanged: 0, relinked: 0 },
  };

  // A template re-imported from a generated SQL file deletes its modules and
  // inserts them again, so every id changes and the links school courses hold
  // now point at rows that no longer exist. A stale link must count as no link
  // at all, or matching skips the title fallback and inserts the whole template
  // a second time - the very doubling this rewrite exists to stop. The link is
  // written back when the row is matched, so this repairs itself each import.
  const liveModuleIds = new Set(templateModules.rows.map((row) => Number(row.id)));
  for (const row of schoolModules.rows) {
    if (row.template_module_id && !liveModuleIds.has(Number(row.template_module_id))) {
      row.template_module_id = null;
    }
  }

  for (const templateModule of templateModules.rows) {
    const match = claimRow(templateModule, schoolModules.rows, "template_module_id");
    let moduleId;

    if (match) {
      moduleId = match.row.id;
      const changed = differingFields(match.row, templateModule, MODULE_FIELDS);
      const restoring = isArchived(match.row);
      const relinking = match.matchedBy !== "link";

      if (changed.length || restoring || relinking) {
        await runQuery(
          `UPDATE course_modules
           SET template_module_id = $1,
               title = $2,
               description = $3,
               learning_outcomes = $4,
               is_published = $5,
               unlock_at = $6,
               archived_at = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            templateModule.id,
            templateModule.title,
            templateModule.description,
            JSON.stringify(templateModule.learning_outcomes || []),
            templateModule.is_published,
            templateModule.unlock_at,
            moduleId,
          ],
        );
        if (relinking) summary.modules.relinked += 1;
        if (changed.length || restoring) summary.modules.updated += 1;
        else summary.modules.unchanged += 1;
      } else {
        summary.modules.unchanged += 1;
      }
    } else {
      const inserted = await runQuery(
        `INSERT INTO course_modules (
           course_id, template_module_id, title, description, learning_outcomes,
           position, is_published, unlock_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          courseId,
          templateModule.id,
          templateModule.title,
          templateModule.description,
          JSON.stringify(templateModule.learning_outcomes || []),
          freePosition(schoolModules.rows, templateModule.position),
          templateModule.is_published,
          templateModule.unlock_at,
        ],
      );
      moduleId = inserted.rows[0].id;
      // Kept in the working set so the next template module sees this position
      // as taken and cannot be handed the same one.
      schoolModules.rows.push({ ...inserted.rows[0], __claimed: true });
      summary.modules.added += 1;
    }

    const templateActivities = await runQuery(
      `SELECT *
       FROM course_template_activities
       WHERE template_module_id = $1
       ORDER BY position`,
      [templateModule.id],
    );
    const schoolActivities = await runQuery(
      "SELECT * FROM learning_activities WHERE module_id = $1",
      [moduleId],
    );

    // Same again for activities. An activity whose link belongs to a template
    // activity that is no longer in this module is treated as unlinked, so the
    // title can reunite it with its replacement.
    const liveActivityIds = new Set(templateActivities.rows.map((row) => Number(row.id)));
    for (const row of schoolActivities.rows) {
      if (row.template_activity_id && !liveActivityIds.has(Number(row.template_activity_id))) {
        row.template_activity_id = null;
      }
    }

    for (const templateActivity of templateActivities.rows) {
      const hit = claimRow(
        templateActivity,
        schoolActivities.rows,
        "template_activity_id",
      );

      if (hit) {
        const changed = differingFields(hit.row, templateActivity, ACTIVITY_FIELDS);
        const restoring = isArchived(hit.row);
        const relinking = hit.matchedBy !== "link";

        if (changed.length || restoring || relinking) {
          await runQuery(
            `UPDATE learning_activities
             SET template_activity_id = $1,
                 title = $2,
                 activity_type = $3,
                 content = $4,
                 points = $5,
                 is_required = $6,
                 availability_mode = $7,
                 completion_rule = $8,
                 pass_score = $9,
                 is_published = $10,
                 archived_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11`,
            [
              templateActivity.id,
              templateActivity.title,
              templateActivity.activity_type,
              JSON.stringify(templateActivity.content || {}),
              templateActivity.points,
              templateActivity.is_required,
              templateActivity.availability_mode || "required",
              templateActivity.completion_rule,
              templateActivity.pass_score,
              templateActivity.is_published,
              hit.row.id,
            ],
          );
          if (relinking) summary.activities.relinked += 1;
          if (changed.length || restoring) summary.activities.updated += 1;
          else summary.activities.unchanged += 1;
        } else {
          summary.activities.unchanged += 1;
        }
      } else {
        const insertedActivity = await runQuery(
          `INSERT INTO learning_activities (
             module_id, template_activity_id, title, activity_type, content, points,
             position, is_required, availability_mode, completion_rule, pass_score, is_published
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            moduleId,
            templateActivity.id,
            templateActivity.title,
            templateActivity.activity_type,
            JSON.stringify(templateActivity.content || {}),
            templateActivity.points,
            freePosition(schoolActivities.rows, templateActivity.position),
            templateActivity.is_required,
            templateActivity.availability_mode || "required",
            templateActivity.completion_rule,
            templateActivity.pass_score,
            templateActivity.is_published,
          ],
        );
        schoolActivities.rows.push({ ...insertedActivity.rows[0], __claimed: true });
        summary.activities.added += 1;
      }
    }
  }

  // What the template does not account for. A row still carrying a template
  // link that no template module claimed means the template dropped it; a row
  // with no link was either written by the school or came from an older import.
  // Neither is deleted here - that is the repair script's job, and it checks for
  // learner work first - but an administrator pressing sync deserves to be told,
  // because this is what makes a course look like it has grown a second half.
  summary.notInTemplate = schoolModules.rows
    .filter((row) => !row.__claimed && !isArchived(row))
    .map((row) => ({
      id: row.id,
      title: row.title,
      was_from_template: Boolean(row.template_module_id),
    }));

  // The bug this replaced was silent and doubled a course, so it is worth
  // refusing to commit one. Inside the transaction this throw undoes every
  // write above it.
  const linked = await runQuery(
    `SELECT COUNT(*) AS linked_modules
     FROM course_modules
     WHERE course_id = $1
       AND template_module_id IS NOT NULL
       AND archived_at IS NULL`,
    [courseId],
  );
  const linkedModules = Number((linked.rows[0] || {}).linked_modules || 0);
  if (linkedModules > templateModules.rows.length) {
    throw new Error(
      `Sync aborted: the course would hold ${linkedModules} modules from a template that has ${templateModules.rows.length}. Nothing was changed.`,
    );
  }

  const synced = await getSchoolCourse(courseId, user, runQuery);
  return { ...synced, sync_summary: summary };
}

// Called straight from the controller, and from rollbackSchoolCourse with that
// transaction already open.
async function syncSchoolCourse(courseId, user = {}, runQuery = null) {
  if (runQuery) return applySync(courseId, user, runQuery);
  return withTransaction((client) => applySync(courseId, user, client.query.bind(client)));
}

async function rollbackSchoolCourse(courseId, user = {}) {
  return withTransaction(async (client) => {
    const runQuery = client.query.bind(client);
    const course = await getSchoolCourse(courseId, user, runQuery);
    if (!course?.template_id) throw new Error("This course is not linked to a template.");

    // Retire the visible school structure without deleting learner evidence.
    // Moving positions out of the active range frees the template positions
    // while progress, submissions, grades, feedback and reports retain their
    // original module/activity ids for historical access.
    await runQuery(
      `UPDATE learning_activities la
       JOIN course_modules cm ON cm.id = la.module_id
       SET la.position = -la.id,
           la.is_published = false,
           la.archived_at = CURRENT_TIMESTAMP
       WHERE cm.course_id = $1
         AND la.archived_at IS NULL`,
      [courseId],
    );
    await runQuery(
      `UPDATE course_modules
       SET position = -id,
           is_published = false,
           archived_at = CURRENT_TIMESTAMP
       WHERE course_id = $1
         AND archived_at IS NULL`,
      [courseId],
    );
    await runQuery(
      `UPDATE course_modules cm
       JOIN course_template_modules tm ON tm.id = cm.template_module_id
       SET cm.position = tm.position
       WHERE cm.course_id = $1`,
      [courseId],
    );
    await runQuery(
      `UPDATE learning_activities la
       JOIN course_template_activities ta ON ta.id = la.template_activity_id
       JOIN course_modules cm ON cm.id = la.module_id
       SET la.position = ta.position
       WHERE cm.course_id = $1`,
      [courseId],
    );

    return syncSchoolCourse(courseId, user, runQuery);
  });
}

module.exports = {
  listTemplates,
  countTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateBuilder,
  getTemplateLearningOverview,
  getTemplateModuleLearning,
  createTemplateModule,
  updateTemplateModule,
  deleteTemplateModule,
  createTemplateActivity,
  updateTemplateActivity,
  deleteTemplateActivity,
  reorderTemplateActivities,
  adoptTemplate,
  getSchoolCourse,
  syncSchoolCourse,
  rollbackSchoolCourse,
  bumpTemplateVersion,
};
