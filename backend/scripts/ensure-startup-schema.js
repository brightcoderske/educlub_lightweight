require("dotenv").config({ path: ".env" });

const { pool } = require("../src/config/db");
const { ensureStartupSchema } = require("../src/services/startupSchema.service");

async function main() {
  await ensureStartupSchema();
  await pool.query(
    "UPDATE courses SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''",
  );
  await pool.query(
    "UPDATE course_templates SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''",
  );
  await pool.query(
    `UPDATE schools
     SET is_independent_school = TRUE
     WHERE LOWER(code) = 'educlub-independent'
        OR LOWER(name) LIKE '%independent learners%'`,
  );

  const result = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('courses', 'course_templates', 'course_allocations', 'schools')
       AND column_name IN (
         'school_id', 'course_category', 'template_id', 'template_version',
         'school_version', 'last_template_sync_at', 'independent_price_amount',
         'independent_currency', 'version', 'is_independent_school',
         'access_level', 'preview_activity_limit', 'paid_at', 'payment_reference'
       )
     ORDER BY table_name, column_name`,
  );

  console.table(result.rows);
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error.message);
    await pool.end();
    process.exit(1);
  });
