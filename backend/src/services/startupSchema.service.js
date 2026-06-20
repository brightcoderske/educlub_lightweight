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
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'paid'",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS preview_activity_limit INTEGER DEFAULT 0",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP",
  "ALTER TABLE IF EXISTS course_allocations ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)",
];

async function ensureStartupSchema() {
  for (const statement of statements) {
    await query(statement);
  }
}

module.exports = {
  ensureStartupSchema,
};
