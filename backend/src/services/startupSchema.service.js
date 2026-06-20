const { query } = require("../config");

const statements = [
  "ALTER TABLE IF EXISTS schools ADD COLUMN IF NOT EXISTS is_independent_school BOOLEAN DEFAULT FALSE",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS code VARCHAR(80)",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS target_level VARCHAR(80)",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS image_url TEXT",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS estimated_weeks INTEGER",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN DEFAULT FALSE",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS independent_price_amount NUMERIC(12, 2) DEFAULT 0",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS independent_currency VARCHAR(10) DEFAULT 'KES'",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS course_category VARCHAR(50) DEFAULT 'general'",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES course_templates(id) ON DELETE SET NULL",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS template_version INTEGER",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS school_version INTEGER DEFAULT 1",
  "ALTER TABLE IF EXISTS courses ADD COLUMN IF NOT EXISTS last_template_sync_at TIMESTAMP",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS code VARCHAR(80)",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS target_level VARCHAR(80)",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS image_url TEXT",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS estimated_weeks INTEGER",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]'::jsonb",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN DEFAULT FALSE",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS independent_price_amount NUMERIC(12, 2) DEFAULT 0",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS independent_currency VARCHAR(10) DEFAULT 'KES'",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS course_category VARCHAR(50) DEFAULT 'general'",
  "ALTER TABLE IF EXISTS course_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'paid'",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS preview_activity_limit INTEGER DEFAULT 0",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)",
  `CREATE TABLE IF NOT EXISTS course_teacher_assignments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deallocated_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, teacher_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS course_update_requests (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_version INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(course_id, teacher_user_id, template_version)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_course_teacher_assignments_teacher_active
    ON course_teacher_assignments(teacher_user_id, is_active, course_id)`,
  `CREATE INDEX IF NOT EXISTS idx_course_teacher_assignments_course_active
    ON course_teacher_assignments(course_id, is_active, teacher_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_course_update_requests_course_status
    ON course_update_requests(course_id, status, template_version)`,
];

async function ensureStartupSchema() {
  for (const statement of statements) {
    await query(statement);
  }
  await query(
    "UPDATE courses SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''",
  );
  await query(
    "UPDATE course_templates SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''",
  );
  await query("UPDATE courses SET is_active = TRUE WHERE is_active IS NULL");
  await query(
    "UPDATE course_templates SET is_active = TRUE WHERE is_active IS NULL",
  );
  await query(
    `UPDATE schools
     SET is_independent_school = TRUE
     WHERE LOWER(code) = 'educlub-independent'
        OR LOWER(name) LIKE '%independent learners%'`,
  );
  await query(
    `UPDATE courses c
     SET school_id = source.school_id
     FROM (
       SELECT ca.course_id, MIN(l.school_id) AS school_id
       FROM course_allocations ca
       JOIN learners l ON l.id = ca.learner_id
       WHERE l.school_id IS NOT NULL
       GROUP BY ca.course_id
       HAVING COUNT(DISTINCT l.school_id) = 1
     ) source
     WHERE c.id = source.course_id
       AND c.school_id IS NULL`,
  );
}

module.exports = {
  ensureStartupSchema,
};
