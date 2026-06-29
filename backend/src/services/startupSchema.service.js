const { query } = require("../config");
const { ensureAiDefaults } = require("./aiSettings.service");

const statements = [
  "ALTER TABLE IF EXISTS schools ADD COLUMN IF NOT EXISTS is_independent_school BOOLEAN DEFAULT FALSE",
  `ALTER TABLE IF EXISTS schools ADD COLUMN IF NOT EXISTS report_card_settings JSONB DEFAULT '{"show_weekly_typing":true,"show_weekly_quizzes":true,"show_active_courses":true,"show_competitions":true,"show_badges":true,"show_teacher_feedback":true}'::jsonb`,
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
  "ALTER TABLE IF EXISTS activity_grades ADD COLUMN IF NOT EXISTS question_marks JSONB DEFAULT '{}'::jsonb",
  `CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    term VARCHAR(50),
    academic_year INTEGER,
    completion_status VARCHAR(50) DEFAULT 'completed',
    status VARCHAR(50) DEFAULT 'pending',
    certificate_url TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  "ALTER TABLE IF EXISTS certificates ALTER COLUMN completion_status SET DEFAULT 'completed'",
  "ALTER TABLE IF EXISTS certificates ALTER COLUMN status SET DEFAULT 'pending'",
  "ALTER TABLE IF EXISTS certificates DROP CONSTRAINT IF EXISTS certificates_completion_status_check",
  "ALTER TABLE IF EXISTS certificates DROP CONSTRAINT IF EXISTS certificates_status_check",
  `ALTER TABLE IF EXISTS certificates ADD CONSTRAINT certificates_completion_status_check
    CHECK (completion_status IN ('completed', 'pending', 'approved', 'issued'))`,
  `ALTER TABLE IF EXISTS certificates ADD CONSTRAINT certificates_status_check
    CHECK (status IN ('pending', 'approved', 'issued'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_unique_award
    ON certificates (
      learner_id,
      course_id,
      COALESCE(term, ''),
      COALESCE(academic_year::text, '')
    )`,
  `CREATE TABLE IF NOT EXISTS course_payments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    allocation_id INTEGER REFERENCES course_allocations(id) ON DELETE SET NULL,
    provider VARCHAR(50) DEFAULT 'flutterwave',
    tx_ref VARCHAR(100) UNIQUE NOT NULL,
    provider_transaction_id VARCHAR(100),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    status VARCHAR(50) DEFAULT 'pending'
      CHECK (status IN ('pending', 'successful', 'failed')),
    payment_link TEXT,
    raw_response JSONB,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS idx_course_payments_tx_ref ON course_payments(tx_ref)",
  "CREATE INDEX IF NOT EXISTS idx_course_payments_provider_transaction ON course_payments(provider_transaction_id)",
  "CREATE INDEX IF NOT EXISTS idx_course_payments_allocation ON course_payments(allocation_id)",
  "CREATE INDEX IF NOT EXISTS idx_course_payments_status_created ON course_payments(status, created_at)",
  "ALTER TABLE IF EXISTS course_payments ENABLE ROW LEVEL SECURITY",
  "DROP POLICY IF EXISTS course_payments_role_access ON course_payments",
  `CREATE POLICY course_payments_role_access ON course_payments
    FOR SELECT
    USING (
      (SELECT public.educlub_role()) = 'system_admin'
      OR EXISTS (
        SELECT 1 FROM learners l
        WHERE l.id = learner_id
          AND (
            (
              (SELECT public.educlub_role()) = 'learner'
              AND l.user_id = (SELECT public.educlub_user_id())
            )
            OR (
              (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
              AND l.school_id = (SELECT public.educlub_school_id())
            )
          )
      )
    )`,
  "DROP POLICY IF EXISTS course_payments_owner_insert ON course_payments",
  "DROP POLICY IF EXISTS course_payments_system_admin_update ON course_payments",
  "DROP POLICY IF EXISTS course_payments_system_admin_delete ON course_payments",
  `CREATE POLICY course_payments_owner_insert ON course_payments
    FOR INSERT
    WITH CHECK (
      (SELECT public.educlub_role()) = 'system_admin'
      OR EXISTS (
        SELECT 1 FROM learners l
        WHERE l.id = learner_id
          AND l.user_id = (SELECT public.educlub_user_id())
      )
    )`,
  `CREATE POLICY course_payments_system_admin_update ON course_payments
    FOR UPDATE
    USING ((SELECT public.educlub_role()) = 'system_admin')
    WITH CHECK ((SELECT public.educlub_role()) = 'system_admin')`,
  `CREATE POLICY course_payments_system_admin_delete ON course_payments
    FOR DELETE
    USING ((SELECT public.educlub_role()) = 'system_admin')`,
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
  `CREATE TABLE IF NOT EXISTS ai_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_roles JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_provider_key VARCHAR(50),
    fallback_provider_key VARCHAR(50),
    max_requests_per_hour INTEGER NOT NULL DEFAULT 50,
    max_tokens_per_hour INTEGER NOT NULL DEFAULT 100000,
    max_requests_per_day INTEGER NOT NULL DEFAULT 250,
    max_tokens_per_day INTEGER NOT NULL DEFAULT 500000,
    retain_prompt_days INTEGER NOT NULL DEFAULT 0,
    debug_logging_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_providers (
    id SERIAL PRIMARY KEY,
    provider_key VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    base_url TEXT,
    api_key_ciphertext TEXT,
    default_model VARCHAR(120),
    fallback_model VARCHAR(120),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_role_limits (
    role VARCHAR(30) PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    requests_per_hour INTEGER NOT NULL DEFAULT 10,
    tokens_per_hour INTEGER NOT NULL DEFAULT 20000,
    requests_per_day INTEGER NOT NULL DEFAULT 40,
    tokens_per_day INTEGER NOT NULL DEFAULT 80000,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS school_ai_settings (
    school_id INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    school_admin_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    teacher_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    learner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
    role VARCHAR(30),
    provider_key VARCHAR(50),
    model VARCHAR(120),
    feature VARCHAR(80),
    activity_id INTEGER,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created ON ai_usage_logs(user_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_school_created ON ai_usage_logs(school_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_role_created ON ai_usage_logs(role, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature_created ON ai_usage_logs(feature, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_school_ai_settings_updated ON school_ai_settings(updated_at)",
  "ALTER TABLE IF EXISTS ai_settings ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE IF EXISTS ai_providers ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE IF EXISTS ai_role_limits ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE IF EXISTS school_ai_settings ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE IF EXISTS ai_usage_logs ENABLE ROW LEVEL SECURITY",
  "DROP POLICY IF EXISTS ai_settings_system_admin ON ai_settings",
  "DROP POLICY IF EXISTS ai_settings_authenticated_read ON ai_settings",
  "DROP POLICY IF EXISTS ai_providers_system_admin ON ai_providers",
  "DROP POLICY IF EXISTS ai_role_limits_system_admin ON ai_role_limits",
  "DROP POLICY IF EXISTS ai_role_limits_authenticated_read ON ai_role_limits",
  "DROP POLICY IF EXISTS school_ai_settings_school_read ON school_ai_settings",
  "DROP POLICY IF EXISTS school_ai_settings_school_admin_insert ON school_ai_settings",
  "DROP POLICY IF EXISTS school_ai_settings_school_admin_update ON school_ai_settings",
  "DROP POLICY IF EXISTS school_ai_settings_system_admin_delete ON school_ai_settings",
  "DROP POLICY IF EXISTS ai_usage_logs_scoped_read ON ai_usage_logs",
  "DROP POLICY IF EXISTS ai_usage_logs_scoped_insert ON ai_usage_logs",
  `CREATE POLICY ai_settings_system_admin ON ai_settings
    FOR ALL
    USING ((SELECT public.educlub_role()) = 'system_admin')
    WITH CHECK ((SELECT public.educlub_role()) = 'system_admin')`,
  `CREATE POLICY ai_settings_authenticated_read ON ai_settings
    FOR SELECT
    USING ((SELECT public.educlub_role()) <> '')`,
  `CREATE POLICY ai_providers_system_admin ON ai_providers
    FOR ALL
    USING ((SELECT public.educlub_role()) = 'system_admin')
    WITH CHECK ((SELECT public.educlub_role()) = 'system_admin')`,
  `CREATE POLICY ai_role_limits_system_admin ON ai_role_limits
    FOR ALL
    USING ((SELECT public.educlub_role()) = 'system_admin')
    WITH CHECK ((SELECT public.educlub_role()) = 'system_admin')`,
  `CREATE POLICY ai_role_limits_authenticated_read ON ai_role_limits
    FOR SELECT
    USING ((SELECT public.educlub_role()) <> '')`,
  `CREATE POLICY school_ai_settings_school_read ON school_ai_settings
    FOR SELECT
    USING (
      (SELECT public.educlub_role()) = 'system_admin'
      OR school_id = (SELECT public.educlub_school_id())
    )`,
  `CREATE POLICY school_ai_settings_school_admin_insert ON school_ai_settings
    FOR INSERT
    WITH CHECK (
      (SELECT public.educlub_role()) = 'system_admin'
      OR (
        (SELECT public.educlub_role()) = 'school_admin'
        AND school_id = (SELECT public.educlub_school_id())
      )
    )`,
  `CREATE POLICY school_ai_settings_school_admin_update ON school_ai_settings
    FOR UPDATE
    USING (
      (SELECT public.educlub_role()) = 'system_admin'
      OR (
        (SELECT public.educlub_role()) = 'school_admin'
        AND school_id = (SELECT public.educlub_school_id())
      )
    )
    WITH CHECK (
      (SELECT public.educlub_role()) = 'system_admin'
      OR (
        (SELECT public.educlub_role()) = 'school_admin'
        AND school_id = (SELECT public.educlub_school_id())
      )
    )`,
  `CREATE POLICY school_ai_settings_system_admin_delete ON school_ai_settings
    FOR DELETE
    USING ((SELECT public.educlub_role()) = 'system_admin')`,
  `CREATE POLICY ai_usage_logs_scoped_read ON ai_usage_logs
    FOR SELECT
    USING (
      (SELECT public.educlub_role()) = 'system_admin'
      OR user_id = (SELECT public.educlub_user_id())
      OR (
        (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND school_id = (SELECT public.educlub_school_id())
      )
    )`,
  `CREATE POLICY ai_usage_logs_scoped_insert ON ai_usage_logs
    FOR INSERT
    WITH CHECK (
      user_id = (SELECT public.educlub_user_id())
      OR (SELECT public.educlub_role()) = 'system_admin'
    )`,
];

async function ensureStartupSchema() {
  for (const statement of statements) {
    await query(statement);
  }
  await query(
    "UPDATE courses SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''"
  );
  await query(
    "UPDATE course_templates SET course_category = 'general' WHERE course_category IS NULL OR course_category = ''"
  );
  await query("UPDATE courses SET is_active = TRUE WHERE is_active IS NULL");
  await query(
    "UPDATE course_templates SET is_active = TRUE WHERE is_active IS NULL"
  );
  await query(
    `UPDATE schools
     SET is_independent_school = TRUE
     WHERE LOWER(code) = 'educlub-independent'
        OR LOWER(name) LIKE '%independent learners%'`
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
       AND c.school_id IS NULL`
  );
  await ensureAiDefaults();
}

module.exports = {
  ensureStartupSchema,
};
