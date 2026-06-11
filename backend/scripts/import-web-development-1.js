require("dotenv").config();
const { pool } = require("../src/config");
const template = require("../src/courseTemplates/webDevelopment1.template");
const { importTemplateDefinition } = require("../src/services/courseTemplateImport.service");

async function main() {
  const client = await pool.connect();
  try {
    const result = await importTemplateDefinition(template, client.query.bind(client));
    console.log(`Imported Web Development 1: template ${result.template_id}, ${result.modules} modules, ${result.activities} activities.`);
    const verification = await client.query(
      `SELECT
         COUNT(DISTINCT tm.id)::integer AS modules,
         COUNT(ta.id)::integer AS activities,
         COUNT(*) FILTER (WHERE ta.activity_type = 'quiz')::integer AS quizzes,
         MIN(ta.pass_score) FILTER (WHERE ta.activity_type = 'quiz') AS min_quiz_pass,
         MAX(ta.pass_score) FILTER (WHERE ta.activity_type = 'quiz') AS max_quiz_pass
       FROM course_templates t
       JOIN course_template_modules tm ON tm.template_id = t.id
       JOIN course_template_activities ta ON ta.template_module_id = tm.id
       WHERE t.code = $1`,
      [template.code],
    );
    const saved = verification.rows[0];
    console.log(
      `Verified database: ${saved.modules} modules, ${saved.activities} activities, ` +
        `${saved.quizzes} quizzes, pass score ${saved.min_quiz_pass}-${saved.max_quiz_pass}.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Web Development 1 import failed:", error);
  process.exitCode = 1;
});
