const path = require("path");

require("../backend/node_modules/dotenv").config({
  path: process.env.EDUCLUB_ENV_FILE || path.join(__dirname, "../backend/.env"),
});
const { Client } = require("../backend/node_modules/pg");

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::integer FROM courses) AS courses,
      (SELECT COUNT(*)::integer FROM course_modules) AS modules,
      (SELECT COUNT(*)::integer FROM learning_activities) AS activities,
      (SELECT COUNT(*)::integer FROM course_allocations) AS allocations,
      (SELECT COUNT(*)::integer FROM activity_progress) AS progress,
      (SELECT COUNT(*)::integer FROM activity_submissions) AS submissions,
      (SELECT COUNT(*)::integer FROM activity_grades) AS grades
  `);
  const structures = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls
    FROM pg_class c
    WHERE c.relname IN (
      'school_module_schedules',
      'learning_availability_overrides',
      'learner_module_badges',
      'module_feedback',
      'feedback_identity_audits'
    )
    ORDER BY c.relname
  `);
  const column = await client.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_name IN ('learning_activities', 'course_template_activities')
      AND column_name = 'availability_mode'
    ORDER BY table_name
  `);

  console.log(JSON.stringify({
    counts: counts.rows[0],
    structures: structures.rows,
    availability_columns: column.rows,
  }));
  await client.end();
}

verify().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
