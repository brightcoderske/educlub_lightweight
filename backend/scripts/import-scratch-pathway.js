require("dotenv").config();
const { pool } = require("../src/config");
const { importTemplateDefinition } = require("../src/services/courseTemplateImport.service");

const templates = [
  require("../src/courseTemplates/scratchIntermediate.template"),
  require("../src/courseTemplates/scratchExplorer.template"),
  require("../src/courseTemplates/scratchCreator.template"),
  require("../src/courseTemplates/scratchInnovator.template"),
];

async function verify(client, template) {
  const result = await client.query(
    `SELECT
       COUNT(DISTINCT tm.id)::integer AS modules,
       COUNT(ta.id)::integer AS activities,
       COUNT(*) FILTER (WHERE ta.activity_type = 'discussion')::integer AS discussions,
       COUNT(*) FILTER (WHERE ta.activity_type = 'quiz')::integer AS quizzes,
       SUM(
         CASE WHEN ta.activity_type = 'quiz'
           THEN jsonb_array_length(COALESCE(ta.content->'questions', '[]'::jsonb))
           ELSE 0
         END
       )::integer AS questions
     FROM course_templates t
     JOIN course_template_modules tm ON tm.template_id = t.id
     JOIN course_template_activities ta ON ta.template_module_id = tm.id
     WHERE t.code = $1`,
    [template.code],
  );
  return result.rows[0];
}

async function main() {
  const client = await pool.connect();
  try {
    for (const template of templates) {
      const imported = await importTemplateDefinition(template, client.query.bind(client));
      const saved = await verify(client, template);
      console.log(
        `${template.code}: template ${imported.template_id}; ` +
        `${saved.modules} modules, ${saved.activities} activities, ` +
        `${saved.discussions} discussions, ${saved.quizzes} quizzes, ${saved.questions} questions.`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Scratch pathway import failed:", error);
  process.exitCode = 1;
});
