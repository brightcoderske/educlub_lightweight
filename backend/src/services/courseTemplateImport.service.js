const { validateTemplateDefinition } = require("../courseTemplates/templateDefinition");

async function importTemplateDefinition(input, query) {
  const definition = validateTemplateDefinition(input);
  let moduleCount = 0;
  let activityCount = 0;
  await query("BEGIN");
  try {
    const templateResult = await query(
      `INSERT INTO course_templates (
         name, code, description, target_level, image_url, estimated_weeks,
         learning_objectives, certificate_enabled, course_category, is_active
       ) VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9, true)
       ON CONFLICT (code) WHERE code IS NOT NULL DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description,
         target_level = EXCLUDED.target_level, image_url = EXCLUDED.image_url,
         estimated_weeks = EXCLUDED.estimated_weeks,
         learning_objectives = EXCLUDED.learning_objectives,
         certificate_enabled = EXCLUDED.certificate_enabled,
         course_category = EXCLUDED.course_category,
         version = course_templates.version + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [definition.name, definition.code, definition.description, definition.target_level,
        definition.image_url || "", definition.estimated_weeks,
        JSON.stringify(definition.learning_objectives), definition.certificate_enabled,
        definition.course_category],
    );
    const templateId = templateResult.rows[0].id;
    for (const module of definition.modules) {
      const moduleResult = await query(
        `INSERT INTO course_template_modules (
           template_id, title, description, learning_outcomes, position, is_published, unlock_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NULL)
         ON CONFLICT (template_id, position) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description,
           learning_outcomes = EXCLUDED.learning_outcomes,
           is_published = EXCLUDED.is_published, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [templateId, module.title, module.description || "",
          JSON.stringify(module.learning_outcomes || []), module.position, module.is_published],
      );
      moduleCount += 1;
      for (const item of module.activities) {
        await query(
          `INSERT INTO course_template_activities (
             template_module_id, title, activity_type, content, points, position,
             is_required, availability_mode, completion_rule, pass_score, is_published
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (template_module_id, position) DO UPDATE SET
             title = EXCLUDED.title, activity_type = EXCLUDED.activity_type,
             content = EXCLUDED.content, points = EXCLUDED.points,
             is_required = EXCLUDED.is_required,
             availability_mode = EXCLUDED.availability_mode,
             completion_rule = EXCLUDED.completion_rule,
             pass_score = EXCLUDED.pass_score,
             is_published = EXCLUDED.is_published,
             updated_at = CURRENT_TIMESTAMP`,
          [moduleResult.rows[0].id, item.title, item.activity_type,
            JSON.stringify({ ...item.content, module_badge: module.badge, teacher_notes: module.teacher_notes, template_settings: definition.settings }),
            item.points, item.position, item.is_required,
            item.availability_mode || "required", item.completion_rule,
            item.pass_score, item.is_published],
        );
        activityCount += 1;
      }
      await query(
        `DELETE FROM course_template_activities
         WHERE template_module_id = $1 AND position > $2`,
        [moduleResult.rows[0].id, module.activities.length],
      );
    }
    await query(
      `DELETE FROM course_template_modules
       WHERE template_id = $1 AND position > $2`,
      [templateId, definition.modules.length],
    );
    await query("COMMIT");
    return { template_id: templateId, modules: moduleCount, activities: activityCount };
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

module.exports = { importTemplateDefinition };
