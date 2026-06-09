-- eduClub LMS Database Schema
-- Based on master context requirements

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  logo_url TEXT,
  allow_self_registration BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('system_admin', 'school_admin', 'teacher', 'learner')),
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  username VARCHAR(50) UNIQUE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  mfa_code VARCHAR(10),
  mfa_code_expires_at TIMESTAMP,
  force_password_reset BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('system_admin', 'school_admin', 'teacher', 'learner'));

-- School Admins table (links users to schools)
CREATE TABLE IF NOT EXISTS school_admins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, school_id)
);

-- Learners table
CREATE TABLE IF NOT EXISTS learners (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  grade VARCHAR(50),
  stream VARCHAR(50),
  term VARCHAR(50),
  academic_year INTEGER,
  next_grade VARCHAR(50),
  next_term VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE learners ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Academic Years table
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  year INTEGER UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

-- Terms table
CREATE TABLE IF NOT EXISTS terms (
  id SERIAL PRIMARY KEY,
  academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  term_type VARCHAR(50) DEFAULT 'regular' CHECK (term_type IN ('regular', 'crash_course', 'holiday_program', 'intensive', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  total_weeks INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_one_active_per_type
  ON terms(term_type)
  WHERE is_active = true;

-- Term Weeks table
CREATE TABLE IF NOT EXISTS term_weeks (
  id SERIAL PRIMARY KEY,
  term_id INTEGER REFERENCES terms(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(term_id, week_number),
  CHECK (end_date > start_date)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(80),
  description TEXT,
  target_level VARCHAR(80),
  image_url TEXT,
  estimated_weeks INTEGER,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  certificate_enabled BOOLEAN DEFAULT FALSE,
  course_category VARCHAR(50) DEFAULT 'general' CHECK (course_category IN ('general', 'weekly_typing', 'weekly_quiz')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS target_level VARCHAR(80);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS estimated_weeks INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_category VARCHAR(50) DEFAULT 'general';
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_course_category_check;
ALTER TABLE courses ADD CONSTRAINT courses_course_category_check
  CHECK (course_category IN ('general', 'weekly_typing', 'weekly_quiz'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_school_code
  ON courses(school_id, code)
  WHERE code IS NOT NULL;

-- Master course templates created by system admins. Schools adopt these into
-- their own courses table, then safely customize their school-owned copy.
CREATE TABLE IF NOT EXISTS course_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(80),
  description TEXT,
  target_level VARCHAR(80),
  image_url TEXT,
  estimated_weeks INTEGER,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  certificate_enabled BOOLEAN DEFAULT FALSE,
  course_category VARCHAR(50) DEFAULT 'general'
    CHECK (course_category IN ('general', 'weekly_typing', 'weekly_quiz')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_templates_code
  ON course_templates(code)
  WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS course_template_modules (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES course_templates(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  learning_outcomes JSONB DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  unlock_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, position)
);

CREATE TABLE IF NOT EXISTS course_template_activities (
  id SERIAL PRIMARY KEY,
  template_module_id INTEGER REFERENCES course_template_modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL
    CHECK (activity_type IN ('lesson', 'quiz', 'assignment', 'discussion', 'coding', 'typing', 'project', 'reflection')),
  content JSONB DEFAULT '{}'::jsonb,
  points NUMERIC(8, 2) DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN DEFAULT TRUE,
  completion_rule VARCHAR(50) DEFAULT 'manual'
    CHECK (completion_rule IN ('manual', 'viewed', 'scrolled', 'submitted', 'graded', 'score_at_least')),
  pass_score NUMERIC(8, 2),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_module_id, position)
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES course_templates(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS template_version INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS last_template_sync_at TIMESTAMP;

-- Native LMS course builder tables
CREATE TABLE IF NOT EXISTS course_modules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  template_module_id INTEGER REFERENCES course_template_modules(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  learning_outcomes JSONB DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN DEFAULT FALSE,
  unlock_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id, position)
);

ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS template_module_id INTEGER REFERENCES course_template_modules(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS learning_activities (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES course_modules(id) ON DELETE CASCADE,
  template_activity_id INTEGER REFERENCES course_template_activities(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL
    CHECK (activity_type IN ('lesson', 'quiz', 'assignment', 'discussion', 'coding', 'typing', 'project', 'reflection')),
  content JSONB DEFAULT '{}'::jsonb,
  points NUMERIC(8, 2) DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN DEFAULT TRUE,
  completion_rule VARCHAR(50) DEFAULT 'manual'
    CHECK (completion_rule IN ('manual', 'viewed', 'scrolled', 'submitted', 'graded', 'score_at_least')),
  pass_score NUMERIC(8, 2),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(module_id, position)
);

ALTER TABLE learning_activities ADD COLUMN IF NOT EXISTS template_activity_id INTEGER REFERENCES course_template_activities(id) ON DELETE SET NULL;

INSERT INTO course_templates (
  name, code, description, target_level, image_url, estimated_weeks,
  learning_objectives, certificate_enabled, course_category, is_active
)
SELECT
  c.name, c.code, c.description, c.target_level, c.image_url, c.estimated_weeks,
  c.learning_objectives, c.certificate_enabled, c.course_category, c.is_active
FROM courses c
WHERE c.school_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM course_templates t
    WHERE (c.code IS NOT NULL AND t.code = c.code)
       OR (c.code IS NULL AND t.code IS NULL AND t.name = c.name)
  );

INSERT INTO course_template_modules (
  template_id, title, description, learning_outcomes, position, is_published, unlock_at
)
SELECT
  t.id, cm.title, cm.description, cm.learning_outcomes, cm.position, cm.is_published, cm.unlock_at
FROM course_modules cm
JOIN courses c ON c.id = cm.course_id
JOIN course_templates t ON (
  (c.code IS NOT NULL AND t.code = c.code)
  OR (c.code IS NULL AND t.code IS NULL AND t.name = c.name)
)
WHERE c.school_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM course_template_modules tm
    WHERE tm.template_id = t.id
      AND tm.position = cm.position
  );

INSERT INTO course_template_activities (
  template_module_id, title, activity_type, content, points, position,
  is_required, completion_rule, pass_score, is_published
)
SELECT
  tm.id, la.title, la.activity_type, la.content, la.points, la.position,
  la.is_required, la.completion_rule, la.pass_score, la.is_published
FROM learning_activities la
JOIN course_modules cm ON cm.id = la.module_id
JOIN courses c ON c.id = cm.course_id
JOIN course_templates t ON (
  (c.code IS NOT NULL AND t.code = c.code)
  OR (c.code IS NULL AND t.code IS NULL AND t.name = c.name)
)
JOIN course_template_modules tm
  ON tm.template_id = t.id
 AND tm.position = cm.position
WHERE c.school_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM course_template_activities ta
    WHERE ta.template_module_id = tm.id
      AND ta.position = la.position
  );

CREATE TABLE IF NOT EXISTS activity_progress (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'started', 'in_progress', 'submitted', 'completed', 'graded')),
  score NUMERIC(8, 2),
  opened_at TIMESTAMP,
  completed_at TIMESTAMP,
  graded_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, activity_id)
);

CREATE TABLE IF NOT EXISTS activity_submissions (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  submission_type VARCHAR(50) DEFAULT 'text'
    CHECK (submission_type IN ('text', 'file', 'image', 'link', 'code', 'project')),
  content JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'returned', 'graded')),
  UNIQUE(learner_id, activity_id)
);

CREATE TABLE IF NOT EXISTS activity_grades (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER REFERENCES activity_submissions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  score NUMERIC(8, 2) CHECK (score >= 0),
  performance_level VARCHAR(80),
  teacher_remarks TEXT,
  graded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, activity_id)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  prompt TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer JSONB DEFAULT '{}'::jsonb,
  points NUMERIC(8, 2) DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  answers JSONB DEFAULT '{}'::jsonb,
  score NUMERIC(8, 2) DEFAULT 0,
  feedback JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, activity_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS discussions (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER REFERENCES learning_activities(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  allow_peer_replies BOOLEAN DEFAULT TRUE,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id SERIAL PRIMARY KEY,
  discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  parent_reply_id INTEGER REFERENCES discussion_replies(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course Allocations table
CREATE TABLE IF NOT EXISTS course_allocations (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  term VARCHAR(50),
  academic_year INTEGER,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed', 'dropped')),
  allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  start_date DATE,
  end_date DATE,
  UNIQUE(learner_id, course_id, term, academic_year)
);

-- Grades Cache table
CREATE TABLE IF NOT EXISTS grades_cache (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year INTEGER NOT NULL,
  UNIQUE(learner_id, course_id, term, academic_year)
);

-- Progress Cache table
CREATE TABLE IF NOT EXISTS progress_cache (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year INTEGER NOT NULL,
  progress_data JSONB NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, course_id, term, academic_year)
);

-- Weekly performance marks table
CREATE TABLE IF NOT EXISTS weekly_marks (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  term VARCHAR(50) NOT NULL,
  academic_year INTEGER NOT NULL,
  quiz_score INTEGER CHECK (quiz_score BETWEEN 0 AND 100),
  typing_score NUMERIC(8, 2) CHECK (typing_score >= 0),
  active_course_score INTEGER CHECK (active_course_score BETWEEN 0 AND 100),
  active_course_modules_completed INTEGER DEFAULT 0,
  active_course_modules_total INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, week_number, term, academic_year)
);

ALTER TABLE weekly_marks DROP CONSTRAINT IF EXISTS weekly_marks_typing_score_check;
ALTER TABLE weekly_marks ADD CONSTRAINT weekly_marks_typing_score_check
  CHECK (typing_score >= 0);

-- Native monthly or seasonal competitions
CREATE TABLE IF NOT EXISTS competitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  competition_type VARCHAR(50) DEFAULT 'quiz' CHECK (competition_type IN ('quiz', 'typing', 'maths', 'science', 'stem')),
  eligible_grades JSONB DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  practice_available BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  price_amount NUMERIC(12, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'KES',
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS typing_tests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  term VARCHAR(50),
  academic_year INTEGER,
  week_number INTEGER,
  test_type VARCHAR(50) DEFAULT 'weekly' CHECK (test_type IN ('weekly', 'competition')),
  competition_id INTEGER REFERENCES competitions(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  eligible_grades JSONB DEFAULT '[]'::jsonb,
  eligible_streams JSONB DEFAULT '[]'::jsonb,
  pass_threshold NUMERIC(8, 2) DEFAULT 25,
  allow_reattempts BOOLEAN DEFAULT TRUE,
  max_attempts INTEGER DEFAULT 3,
  duration_seconds INTEGER DEFAULT 300,
  deadline_at TIMESTAMP,
  is_published BOOLEAN DEFAULT FALSE,
  is_open BOOLEAN DEFAULT FALSE,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS typing_lessons (
  id SERIAL PRIMARY KEY,
  typing_test_id INTEGER REFERENCES typing_tests(id) ON DELETE CASCADE,
  lesson_order INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  passage TEXT NOT NULL,
  instructions TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(typing_test_id, lesson_order)
);

CREATE TABLE IF NOT EXISTS typing_attempts (
  id SERIAL PRIMARY KEY,
  typing_test_id INTEGER REFERENCES typing_tests(id) ON DELETE CASCADE,
  typing_lesson_id INTEGER REFERENCES typing_lessons(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  typed_text TEXT,
  raw_wpm NUMERIC(8, 2) DEFAULT 0,
  accuracy NUMERIC(5, 2) DEFAULT 0,
  mistakes INTEGER DEFAULT 0,
  final_score NUMERIC(8, 2) DEFAULT 0,
  duration_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(typing_lesson_id, learner_id, attempt_number)
);

-- Leaderboards table (cached weekly leaderboards)
CREATE TABLE IF NOT EXISTS weekly_leaderboards (
  id SERIAL PRIMARY KEY,
  week_number INTEGER NOT NULL,
  term VARCHAR(50) NOT NULL,
  academic_year INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('quiz', 'typing', 'active_course')),
  leaderboard_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_number, term, academic_year, category)
);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  term VARCHAR(50),
  academic_year INTEGER,
  completion_status VARCHAR(50) DEFAULT 'pending' CHECK (completion_status IN ('pending', 'approved', 'issued')),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'issued')),
  certificate_url TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  report_type VARCHAR(50) NOT NULL,
  term VARCHAR(50),
  academic_year INTEGER,
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_feedback (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year INTEGER NOT NULL,
  comment_text TEXT NOT NULL,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learner_id, term, academic_year)
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Versioned privacy and user agreement consent records
CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  policy_version VARCHAR(50) NOT NULL,
  policy_title VARCHAR(255) NOT NULL,
  consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  consent_text JSONB NOT NULL,
  UNIQUE(user_id, policy_version)
);

CREATE TABLE IF NOT EXISTS learner_parent_consents (
  id SERIAL PRIMARY KEY,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_full_name VARCHAR(255) NOT NULL,
  parent_phone VARCHAR(50) NOT NULL,
  parent_email VARCHAR(255),
  consent_competition_updates BOOLEAN DEFAULT FALSE,
  consent_open_course_updates BOOLEAN DEFAULT FALSE,
  consent_text JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_threads (
  id SERIAL PRIMARY KEY,
  learner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  subject VARCHAR(255) DEFAULT 'Learner feedback',
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  learner_last_read_at TIMESTAMP,
  admin_last_read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES feedback_threads(id) ON DELETE CASCADE,
  sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_role VARCHAR(50) NOT NULL CHECK (sender_role IN ('system_admin', 'learner')),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Short-lived one-time password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

-- Trusted MFA devices. Tokens are random, stored hashed, and expire after 12 hours.
CREATE TABLE IF NOT EXISTS trusted_mfa_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MFA Settings table
CREATE TABLE IF NOT EXISTS mfa_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret VARCHAR(255),
  backup_codes TEXT[],
  is_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value)
VALUES (
  'mfa_policy',
  '{"system_admin": true, "school_admin": true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Role-aware notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(80) DEFAULT 'info',
  entity_type VARCHAR(100),
  entity_id INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS competition_type VARCHAR(50) DEFAULT 'quiz';
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS eligible_grades JSONB DEFAULT '[]'::jsonb;
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_competition_type_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_competition_type_check
  CHECK (competition_type IN ('quiz', 'typing', 'maths', 'science', 'stem'));

CREATE TABLE IF NOT EXISTS competition_enrollments (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'enrolled', 'cancelled')),
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'KES',
  payment_reference VARCHAR(100),
  enrolled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, learner_id)
);

CREATE TABLE IF NOT EXISTS competition_payments (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  enrollment_id INTEGER REFERENCES competition_enrollments(id) ON DELETE SET NULL,
  provider VARCHAR(50) DEFAULT 'flutterwave',
  tx_ref VARCHAR(100) UNIQUE NOT NULL,
  provider_transaction_id VARCHAR(100),
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'cancelled')),
  payment_link TEXT,
  raw_response JSONB,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competition_results (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  result_stage VARCHAR(50) DEFAULT 'final' CHECK (result_stage IN ('practice', 'final')),
  learner_grade VARCHAR(50),
  competition_type VARCHAR(50) DEFAULT 'quiz',
  quiz_score NUMERIC(6, 2),
  typing_wpm NUMERIC(6, 2),
  typing_accuracy NUMERIC(6, 2),
  total_score NUMERIC(8, 2),
  rank INTEGER,
  source VARCHAR(50) DEFAULT 'manual',
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, learner_id)
);

ALTER TABLE competition_results ADD COLUMN IF NOT EXISTS result_stage VARCHAR(50) DEFAULT 'final';
ALTER TABLE competition_results ADD COLUMN IF NOT EXISTS learner_grade VARCHAR(50);
ALTER TABLE competition_results ADD COLUMN IF NOT EXISTS competition_type VARCHAR(50) DEFAULT 'quiz';
ALTER TABLE competition_results DROP CONSTRAINT IF EXISTS competition_results_result_stage_check;
ALTER TABLE competition_results ADD CONSTRAINT competition_results_result_stage_check
  CHECK (result_stage IN ('practice', 'final'));
ALTER TABLE competition_results DROP CONSTRAINT IF EXISTS competition_results_competition_id_learner_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_results_unique_stage
  ON competition_results(competition_id, learner_id, result_stage);

CREATE TABLE IF NOT EXISTS competition_reminders (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
  learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, learner_id, reminder_type)
);

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role_school_active ON users(role, school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_learners_user_id ON learners(user_id);
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_learners_school_id ON learners(school_id);
CREATE INDEX IF NOT EXISTS idx_learners_grade ON learners(grade);
CREATE INDEX IF NOT EXISTS idx_learners_term ON learners(term);
CREATE INDEX IF NOT EXISTS idx_learners_school_grade_stream_active ON learners(school_id, grade, stream, is_active);
CREATE INDEX IF NOT EXISTS idx_learners_lower_email ON learners(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_courses_active_name ON courses(is_active, name);
CREATE INDEX IF NOT EXISTS idx_courses_school_template ON courses(school_id, template_id);
CREATE INDEX IF NOT EXISTS idx_course_templates_active_name ON course_templates(is_active, name);
CREATE INDEX IF NOT EXISTS idx_course_template_modules_template_position ON course_template_modules(template_id, position);
CREATE INDEX IF NOT EXISTS idx_course_template_activities_module_position ON course_template_activities(template_module_id, position);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_position ON course_modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_learning_activities_module_position ON learning_activities(module_id, position);
CREATE INDEX IF NOT EXISTS idx_activity_progress_learner_activity ON activity_progress(learner_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_learner_activity ON activity_submissions(learner_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_grades_learner_activity ON activity_grades(learner_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_activity_position ON quiz_questions(activity_id, position);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_learner_activity ON quiz_attempts(learner_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_discussions_activity ON discussions(activity_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion ON discussion_replies(discussion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_course_allocations_learner_id ON course_allocations(learner_id);
CREATE INDEX IF NOT EXISTS idx_course_allocations_course_id ON course_allocations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_allocations_learner_status ON course_allocations(learner_id, status);
CREATE INDEX IF NOT EXISTS idx_course_allocations_course_status ON course_allocations(course_id, status);
CREATE INDEX IF NOT EXISTS idx_course_allocations_term_year ON course_allocations(term, academic_year);
CREATE INDEX IF NOT EXISTS idx_grades_cache_lookup ON grades_cache(learner_id, course_id, term, academic_year);
CREATE INDEX IF NOT EXISTS idx_progress_cache_lookup ON progress_cache(learner_id, course_id, term, academic_year);
CREATE INDEX IF NOT EXISTS idx_weekly_marks_learner_period ON weekly_marks(learner_id, academic_year, term, week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_marks_period ON weekly_marks(academic_year, term, week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_leaderboards_period ON weekly_leaderboards(academic_year, term, week_number, category);
CREATE INDEX IF NOT EXISTS idx_typing_tests_period ON typing_tests(academic_year, term, week_number, test_type);
CREATE INDEX IF NOT EXISTS idx_typing_tests_status ON typing_tests(is_published, is_open, deadline_at);
CREATE INDEX IF NOT EXISTS idx_typing_lessons_test_order ON typing_lessons(typing_test_id, lesson_order);
CREATE INDEX IF NOT EXISTS idx_typing_attempts_lookup ON typing_attempts(typing_test_id, typing_lesson_id, learner_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_certificates_learner_id ON certificates(learner_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_learner_status ON certificates(learner_id, status, completion_status);
CREATE INDEX IF NOT EXISTS idx_reports_learner_id ON reports(learner_id);
CREATE INDEX IF NOT EXISTS idx_reports_learner_period_type ON reports(learner_id, academic_year, term, report_type);
CREATE INDEX IF NOT EXISTS idx_report_feedback_period ON report_feedback(school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_version ON user_consents(user_id, policy_version);
CREATE INDEX IF NOT EXISTS idx_learner_parent_consents_user ON learner_parent_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_parent_consents_learner ON learner_parent_consents(learner_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_learner_user ON feedback_threads(learner_user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_school_status_updated ON feedback_threads(school_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_updated ON feedback_threads(updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread ON feedback_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_sender ON feedback_messages(sender_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active ON password_reset_tokens(user_id, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_mfa_devices_hash ON trusted_mfa_devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_trusted_mfa_devices_user ON trusted_mfa_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_mfa_devices_active ON trusted_mfa_devices(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mfa_settings_user_enabled ON mfa_settings(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role_school ON notifications(role, school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_competitions_dates ON competitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_featured ON competitions(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_competitions_active_dates ON competitions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_type ON competitions(competition_type);
CREATE INDEX IF NOT EXISTS idx_competitions_eligible_grades ON competitions USING GIN (eligible_grades);
CREATE INDEX IF NOT EXISTS idx_courses_category_active ON courses(course_category, is_active);
CREATE INDEX IF NOT EXISTS idx_competition_enrollments_competition ON competition_enrollments(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_enrollments_learner ON competition_enrollments(learner_id);
CREATE INDEX IF NOT EXISTS idx_competition_enrollments_learner_status ON competition_enrollments(learner_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_competition_enrollments_competition_status ON competition_enrollments(competition_id, status);
CREATE INDEX IF NOT EXISTS idx_competition_payments_tx_ref ON competition_payments(tx_ref);
CREATE INDEX IF NOT EXISTS idx_competition_payments_provider_transaction ON competition_payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_competition_payments_status_created ON competition_payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_competition_payments_enrollment ON competition_payments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_competition ON competition_results(competition_id, total_score);
CREATE INDEX IF NOT EXISTS idx_competition_results_rank ON competition_results(competition_id, rank);
CREATE INDEX IF NOT EXISTS idx_competition_results_learner ON competition_results(learner_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_filters ON competition_results(competition_id, result_stage, learner_grade, competition_type, total_score);
CREATE INDEX IF NOT EXISTS idx_competition_reminders_competition ON competition_reminders(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_reminders_learner ON competition_reminders(learner_id, sent_at);

UPDATE learners l
SET user_id = u.id
FROM users u
WHERE l.user_id IS NULL
  AND u.role = 'learner'
  AND u.school_id = l.school_id
  AND u.full_name = l.full_name;

-- RLS helper functions keep Supabase policy checks fast and aligned with the
-- JWT context that the API stores in PostgreSQL settings per request.
CREATE OR REPLACE FUNCTION public.educlub_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT current_setting('educlub.role', true)
$$;

CREATE OR REPLACE FUNCTION public.educlub_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('educlub.user_id', true), '')::integer
$$;

CREATE OR REPLACE FUNCTION public.educlub_school_id()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('educlub.school_id', true), '')::integer
$$;

-- Enable RLS on every application table in the public schema so Supabase does
-- not expose tables accidentally through anon/authenticated API roles.
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_template_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_template_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_parent_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_mfa_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_role_access ON schools;
CREATE POLICY schools_role_access ON schools
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR id = (SELECT public.educlub_school_id())
  );

DROP POLICY IF EXISTS schools_system_admin_insert ON schools;
DROP POLICY IF EXISTS schools_system_admin_update ON schools;
DROP POLICY IF EXISTS schools_system_admin_delete ON schools;
CREATE POLICY schools_system_admin_insert ON schools
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY schools_system_admin_update ON schools
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY schools_system_admin_delete ON schools
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS users_role_access ON users;
CREATE POLICY users_role_access ON users
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR id = (SELECT public.educlub_user_id())
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS users_system_admin_insert ON users;
DROP POLICY IF EXISTS users_system_admin_update ON users;
DROP POLICY IF EXISTS users_system_admin_delete ON users;
CREATE POLICY users_system_admin_insert ON users
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY users_system_admin_update ON users
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY users_system_admin_delete ON users
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS school_admins_role_access ON school_admins;
CREATE POLICY school_admins_role_access ON school_admins
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS school_admins_system_admin_insert ON school_admins;
DROP POLICY IF EXISTS school_admins_system_admin_update ON school_admins;
DROP POLICY IF EXISTS school_admins_system_admin_delete ON school_admins;
CREATE POLICY school_admins_system_admin_insert ON school_admins
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY school_admins_system_admin_update ON school_admins
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY school_admins_system_admin_delete ON school_admins
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS learners_role_access ON learners;
CREATE POLICY learners_role_access ON learners
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
    OR (
      (SELECT public.educlub_role()) = 'learner'
      AND user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS learners_staff_insert ON learners;
DROP POLICY IF EXISTS learners_staff_update ON learners;
DROP POLICY IF EXISTS learners_staff_delete ON learners;
CREATE POLICY learners_staff_insert ON learners
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY learners_staff_update ON learners
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY learners_staff_delete ON learners
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS catalog_role_read ON academic_years;
CREATE POLICY catalog_role_read ON academic_years
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));

DROP POLICY IF EXISTS catalog_system_admin_write ON academic_years;
DROP POLICY IF EXISTS catalog_system_admin_insert ON academic_years;
DROP POLICY IF EXISTS catalog_system_admin_update ON academic_years;
DROP POLICY IF EXISTS catalog_system_admin_delete ON academic_years;
CREATE POLICY catalog_system_admin_insert ON academic_years
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_update ON academic_years
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_delete ON academic_years
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS catalog_role_read ON terms;
CREATE POLICY catalog_role_read ON terms
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));

DROP POLICY IF EXISTS catalog_system_admin_write ON terms;
DROP POLICY IF EXISTS catalog_system_admin_insert ON terms;
DROP POLICY IF EXISTS catalog_system_admin_update ON terms;
DROP POLICY IF EXISTS catalog_system_admin_delete ON terms;
CREATE POLICY catalog_system_admin_insert ON terms
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_update ON terms
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_delete ON terms
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS catalog_role_read ON term_weeks;
CREATE POLICY catalog_role_read ON term_weeks
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));

DROP POLICY IF EXISTS catalog_system_admin_write ON term_weeks;
DROP POLICY IF EXISTS catalog_system_admin_insert ON term_weeks;
DROP POLICY IF EXISTS catalog_system_admin_update ON term_weeks;
DROP POLICY IF EXISTS catalog_system_admin_delete ON term_weeks;
CREATE POLICY catalog_system_admin_insert ON term_weeks
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_update ON term_weeks
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY catalog_system_admin_delete ON term_weeks
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS courses_role_read ON courses;
CREATE POLICY courses_role_read ON courses
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
      AND is_active IS TRUE
    )
    OR (
      (SELECT public.educlub_role()) = 'learner'
      AND is_active IS TRUE
      AND EXISTS (
        SELECT 1
        FROM course_allocations a
        JOIN learners l ON l.id = a.learner_id
        WHERE a.course_id = courses.id
          AND l.user_id = (SELECT public.educlub_user_id())
          AND a.status IN ('active', 'in_progress', 'completed')
      )
    )
  );

DROP POLICY IF EXISTS courses_system_admin_write ON courses;
DROP POLICY IF EXISTS courses_system_admin_insert ON courses;
DROP POLICY IF EXISTS courses_system_admin_update ON courses;
DROP POLICY IF EXISTS courses_system_admin_delete ON courses;
CREATE POLICY courses_system_admin_insert ON courses
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY courses_system_admin_update ON courses
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY courses_system_admin_delete ON courses
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS courses_school_staff_insert ON courses;
DROP POLICY IF EXISTS courses_school_staff_update ON courses;
DROP POLICY IF EXISTS courses_school_staff_delete ON courses;
CREATE POLICY courses_school_staff_insert ON courses
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
    AND school_id = (SELECT public.educlub_school_id())
  );
CREATE POLICY courses_school_staff_update ON courses
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
    AND school_id = (SELECT public.educlub_school_id())
  )
  WITH CHECK (
    (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
    AND school_id = (SELECT public.educlub_school_id())
  );
CREATE POLICY courses_school_staff_delete ON courses
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
    AND school_id = (SELECT public.educlub_school_id())
  );

DROP POLICY IF EXISTS course_templates_read ON course_templates;
CREATE POLICY course_templates_read ON course_templates
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND is_active IS TRUE
    )
  );

DROP POLICY IF EXISTS course_templates_system_admin_write ON course_templates;
CREATE POLICY course_templates_system_admin_write ON course_templates
  FOR ALL
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS course_template_modules_read ON course_template_modules;
CREATE POLICY course_template_modules_read ON course_template_modules
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND is_published IS TRUE
      AND EXISTS (
        SELECT 1
        FROM course_templates t
        WHERE t.id = template_id
          AND t.is_active IS TRUE
      )
    )
  );

DROP POLICY IF EXISTS course_template_modules_system_admin_write ON course_template_modules;
CREATE POLICY course_template_modules_system_admin_write ON course_template_modules
  FOR ALL
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS course_template_activities_read ON course_template_activities;
CREATE POLICY course_template_activities_read ON course_template_activities
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND is_published IS TRUE
      AND EXISTS (
        SELECT 1
        FROM course_template_modules tm
        JOIN course_templates t ON t.id = tm.template_id
        WHERE tm.id = template_module_id
          AND tm.is_published IS TRUE
          AND t.is_active IS TRUE
      )
    )
  );

DROP POLICY IF EXISTS course_template_activities_system_admin_write ON course_template_activities;
CREATE POLICY course_template_activities_system_admin_write ON course_template_activities
  FOR ALL
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS course_builder_read ON course_modules;
CREATE POLICY course_builder_read ON course_modules
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      is_published IS TRUE
      AND EXISTS (
        SELECT 1
        FROM courses c
        LEFT JOIN course_allocations a ON a.course_id = c.id
        LEFT JOIN learners l ON l.id = a.learner_id
        WHERE c.id = course_id
          AND (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND c.school_id = (SELECT public.educlub_school_id())
            OR (
              (SELECT public.educlub_role()) = 'learner'
              AND l.user_id = (SELECT public.educlub_user_id())
              AND a.status IN ('active', 'in_progress', 'completed')
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS course_modules_staff_write ON course_modules;
CREATE POLICY course_modules_staff_write ON course_modules
  FOR ALL
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND EXISTS (
        SELECT 1
        FROM courses c
        WHERE c.id = course_id
          AND c.school_id = (SELECT public.educlub_school_id())
      )
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND EXISTS (
        SELECT 1
        FROM courses c
        WHERE c.id = course_id
          AND c.school_id = (SELECT public.educlub_school_id())
      )
    )
  );

DROP POLICY IF EXISTS learning_activities_read ON learning_activities;
CREATE POLICY learning_activities_read ON learning_activities
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      is_published IS TRUE
      AND EXISTS (
        SELECT 1
        FROM course_modules cm
        JOIN courses c ON c.id = cm.course_id
        LEFT JOIN course_allocations a ON a.course_id = c.id
        LEFT JOIN learners l ON l.id = a.learner_id
        WHERE cm.id = module_id
          AND (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND c.school_id = (SELECT public.educlub_school_id())
            OR (
              (SELECT public.educlub_role()) = 'learner'
              AND l.user_id = (SELECT public.educlub_user_id())
              AND a.status IN ('active', 'in_progress', 'completed')
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS learning_activities_staff_write ON learning_activities;
CREATE POLICY learning_activities_staff_write ON learning_activities
  FOR ALL
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND EXISTS (
        SELECT 1
        FROM course_modules cm
        JOIN courses c ON c.id = cm.course_id
        WHERE cm.id = module_id
          AND c.school_id = (SELECT public.educlub_school_id())
      )
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND EXISTS (
        SELECT 1
        FROM course_modules cm
        JOIN courses c ON c.id = cm.course_id
        WHERE cm.id = module_id
          AND c.school_id = (SELECT public.educlub_school_id())
      )
    )
  );

DROP POLICY IF EXISTS learner_activity_progress_access ON activity_progress;
CREATE POLICY learner_activity_progress_access ON activity_progress
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1
      FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS learner_activity_progress_write ON activity_progress;
CREATE POLICY learner_activity_progress_write ON activity_progress
  FOR ALL
  USING (
    (SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher')
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher')
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS learner_submissions_access ON activity_submissions;
CREATE POLICY learner_submissions_access ON activity_submissions
  FOR ALL
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS activity_grades_access ON activity_grades;
CREATE POLICY activity_grades_access ON activity_grades
  FOR ALL
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  )
  WITH CHECK ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher'));

DROP POLICY IF EXISTS activity_children_read ON quiz_questions;
CREATE POLICY activity_children_read ON quiz_questions
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));
DROP POLICY IF EXISTS activity_children_write ON quiz_questions;
CREATE POLICY activity_children_write ON quiz_questions
  FOR ALL
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher'))
  WITH CHECK ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher'));

DROP POLICY IF EXISTS quiz_attempts_access ON quiz_attempts;
CREATE POLICY quiz_attempts_access ON quiz_attempts
  FOR ALL
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS discussions_read ON discussions;
CREATE POLICY discussions_read ON discussions
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));
DROP POLICY IF EXISTS discussions_staff_write ON discussions;
CREATE POLICY discussions_staff_write ON discussions
  FOR ALL
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher'))
  WITH CHECK ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher'));

DROP POLICY IF EXISTS discussion_replies_access ON discussion_replies;
CREATE POLICY discussion_replies_access ON discussion_replies
  FOR ALL
  USING (
    (SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher')
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher')
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS learner_owned_school_access ON course_allocations;
CREATE POLICY learner_owned_school_access ON course_allocations
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS course_allocations_staff_insert ON course_allocations;
DROP POLICY IF EXISTS course_allocations_staff_update ON course_allocations;
DROP POLICY IF EXISTS course_allocations_staff_delete ON course_allocations;
CREATE POLICY course_allocations_staff_insert ON course_allocations
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY course_allocations_staff_update ON course_allocations
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY course_allocations_staff_delete ON course_allocations
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS cache_role_access ON grades_cache;
CREATE POLICY cache_role_access ON grades_cache
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS grades_cache_system_admin_write ON grades_cache;
DROP POLICY IF EXISTS grades_cache_system_admin_insert ON grades_cache;
DROP POLICY IF EXISTS grades_cache_system_admin_update ON grades_cache;
DROP POLICY IF EXISTS grades_cache_system_admin_delete ON grades_cache;
CREATE POLICY grades_cache_system_admin_insert ON grades_cache
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY grades_cache_system_admin_update ON grades_cache
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY grades_cache_system_admin_delete ON grades_cache
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS cache_role_access ON progress_cache;
CREATE POLICY cache_role_access ON progress_cache
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS progress_cache_system_admin_write ON progress_cache;
DROP POLICY IF EXISTS progress_cache_owner_insert ON progress_cache;
DROP POLICY IF EXISTS progress_cache_owner_update ON progress_cache;
DROP POLICY IF EXISTS progress_cache_staff_insert ON progress_cache;
DROP POLICY IF EXISTS progress_cache_staff_update ON progress_cache;
DROP POLICY IF EXISTS progress_cache_system_admin_insert ON progress_cache;
DROP POLICY IF EXISTS progress_cache_system_admin_update ON progress_cache;
DROP POLICY IF EXISTS progress_cache_system_admin_delete ON progress_cache;
CREATE POLICY progress_cache_owner_insert ON progress_cache
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY progress_cache_owner_update ON progress_cache
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY progress_cache_staff_insert ON progress_cache
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY progress_cache_staff_update ON progress_cache
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY progress_cache_system_admin_insert ON progress_cache
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY progress_cache_system_admin_update ON progress_cache
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY progress_cache_system_admin_delete ON progress_cache
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS learner_owned_school_access ON weekly_marks;
CREATE POLICY learner_owned_school_access ON weekly_marks
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS weekly_marks_staff_insert ON weekly_marks;
DROP POLICY IF EXISTS weekly_marks_staff_update ON weekly_marks;
DROP POLICY IF EXISTS weekly_marks_staff_delete ON weekly_marks;
DROP POLICY IF EXISTS weekly_marks_owner_insert ON weekly_marks;
DROP POLICY IF EXISTS weekly_marks_owner_update ON weekly_marks;
CREATE POLICY weekly_marks_owner_insert ON weekly_marks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY weekly_marks_owner_update ON weekly_marks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY weekly_marks_staff_insert ON weekly_marks
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY weekly_marks_staff_update ON weekly_marks
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY weekly_marks_staff_delete ON weekly_marks
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS typing_tests_role_access ON typing_tests;
CREATE POLICY typing_tests_role_access ON typing_tests
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND (school_id IS NULL OR school_id = (SELECT public.educlub_school_id()))
    )
    OR (
      (SELECT public.educlub_role()) = 'learner'
      AND is_published IS TRUE
      AND is_open IS TRUE
      AND EXISTS (
        SELECT 1 FROM learners l
        WHERE l.user_id = (SELECT public.educlub_user_id())
          AND (
            school_id IS NULL OR school_id = l.school_id
          )
          AND (
            jsonb_array_length(COALESCE(eligible_grades, '[]'::jsonb)) = 0
            OR COALESCE(eligible_grades, '[]'::jsonb) ? l.grade
          )
          AND (
            jsonb_array_length(COALESCE(eligible_streams, '[]'::jsonb)) = 0
            OR COALESCE(eligible_streams, '[]'::jsonb) ? COALESCE(l.stream, '')
          )
      )
    )
  );

DROP POLICY IF EXISTS typing_tests_admin_insert ON typing_tests;
DROP POLICY IF EXISTS typing_tests_admin_update ON typing_tests;
DROP POLICY IF EXISTS typing_tests_admin_delete ON typing_tests;
CREATE POLICY typing_tests_admin_insert ON typing_tests
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY typing_tests_admin_update ON typing_tests
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY typing_tests_admin_delete ON typing_tests
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS typing_lessons_role_access ON typing_lessons;
CREATE POLICY typing_lessons_role_access ON typing_lessons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM typing_tests tt
      WHERE tt.id = typing_test_id
    )
  );

DROP POLICY IF EXISTS typing_lessons_admin_insert ON typing_lessons;
DROP POLICY IF EXISTS typing_lessons_admin_update ON typing_lessons;
DROP POLICY IF EXISTS typing_lessons_admin_delete ON typing_lessons;
CREATE POLICY typing_lessons_admin_insert ON typing_lessons
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY typing_lessons_admin_update ON typing_lessons
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY typing_lessons_admin_delete ON typing_lessons
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS typing_attempts_role_access ON typing_attempts;
CREATE POLICY typing_attempts_role_access ON typing_attempts
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          l.user_id = (SELECT public.educlub_user_id())
          OR (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS typing_attempts_learner_insert ON typing_attempts;
CREATE POLICY typing_attempts_learner_insert ON typing_attempts
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'learner'
    AND EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS leaderboard_role_read ON weekly_leaderboards;
CREATE POLICY leaderboard_role_read ON weekly_leaderboards
  FOR SELECT
  USING ((SELECT public.educlub_role()) IN ('system_admin', 'school_admin', 'teacher', 'learner'));

DROP POLICY IF EXISTS leaderboard_system_admin_write ON weekly_leaderboards;
DROP POLICY IF EXISTS leaderboard_system_admin_insert ON weekly_leaderboards;
DROP POLICY IF EXISTS leaderboard_system_admin_update ON weekly_leaderboards;
DROP POLICY IF EXISTS leaderboard_system_admin_delete ON weekly_leaderboards;
CREATE POLICY leaderboard_system_admin_insert ON weekly_leaderboards
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY leaderboard_system_admin_update ON weekly_leaderboards
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY leaderboard_system_admin_delete ON weekly_leaderboards
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS learner_owned_school_access ON certificates;
CREATE POLICY learner_owned_school_access ON certificates
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS certificates_staff_insert ON certificates;
DROP POLICY IF EXISTS certificates_staff_update ON certificates;
DROP POLICY IF EXISTS certificates_staff_delete ON certificates;
CREATE POLICY certificates_staff_insert ON certificates
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY certificates_staff_update ON certificates
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY certificates_staff_delete ON certificates
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS learner_owned_school_access ON reports;
CREATE POLICY learner_owned_school_access ON reports
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS reports_staff_insert ON reports;
DROP POLICY IF EXISTS reports_staff_update ON reports;
DROP POLICY IF EXISTS reports_staff_delete ON reports;
CREATE POLICY reports_staff_insert ON reports
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY reports_staff_update ON reports
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY reports_staff_delete ON reports
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS report_feedback_role_access ON report_feedback;
CREATE POLICY report_feedback_role_access ON report_feedback
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (
          (
            (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
            AND l.school_id = (SELECT public.educlub_school_id())
          )
          OR (
            (SELECT public.educlub_role()) = 'learner'
            AND l.user_id = (SELECT public.educlub_user_id())
          )
        )
    )
  );

DROP POLICY IF EXISTS report_feedback_staff_insert ON report_feedback;
DROP POLICY IF EXISTS report_feedback_staff_update ON report_feedback;
DROP POLICY IF EXISTS report_feedback_staff_delete ON report_feedback;
CREATE POLICY report_feedback_staff_insert ON report_feedback
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.school_id = school_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY report_feedback_staff_update ON report_feedback
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.school_id = school_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.school_id = school_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY report_feedback_staff_delete ON report_feedback
  FOR DELETE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.school_id = school_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS audit_logs_system_admin_only ON audit_logs;
CREATE POLICY audit_logs_system_admin_only ON audit_logs
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS user_consents_role_access ON user_consents;
CREATE POLICY user_consents_role_access ON user_consents
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS user_consents_owner_insert ON user_consents;
CREATE POLICY user_consents_owner_insert ON user_consents
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS learner_parent_consents_role_access ON learner_parent_consents;
CREATE POLICY learner_parent_consents_role_access ON learner_parent_consents
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND l.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS learner_parent_consents_owner_insert ON learner_parent_consents;
CREATE POLICY learner_parent_consents_owner_insert ON learner_parent_consents
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS feedback_threads_role_access ON feedback_threads;
CREATE POLICY feedback_threads_role_access ON feedback_threads
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR learner_user_id = (SELECT public.educlub_user_id())
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS feedback_threads_owner_insert ON feedback_threads;
DROP POLICY IF EXISTS feedback_threads_owner_update ON feedback_threads;
DROP POLICY IF EXISTS feedback_threads_system_admin_delete ON feedback_threads;
CREATE POLICY feedback_threads_owner_insert ON feedback_threads
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR learner_user_id = (SELECT public.educlub_user_id())
  );
CREATE POLICY feedback_threads_owner_update ON feedback_threads
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR learner_user_id = (SELECT public.educlub_user_id())
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR learner_user_id = (SELECT public.educlub_user_id())
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
      AND school_id = (SELECT public.educlub_school_id())
    )
  );
CREATE POLICY feedback_threads_system_admin_delete ON feedback_threads
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS feedback_messages_role_access ON feedback_messages;
CREATE POLICY feedback_messages_role_access ON feedback_messages
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM feedback_threads ft
      WHERE ft.id = thread_id
        AND ft.learner_user_id = (SELECT public.educlub_user_id())
    )
    OR EXISTS (
      SELECT 1 FROM feedback_threads ft
      WHERE ft.id = thread_id
        AND (SELECT public.educlub_role()) IN ('school_admin', 'teacher')
        AND ft.school_id = (SELECT public.educlub_school_id())
    )
  );

DROP POLICY IF EXISTS feedback_messages_owner_insert ON feedback_messages;
DROP POLICY IF EXISTS feedback_messages_system_admin_delete ON feedback_messages;
CREATE POLICY feedback_messages_owner_insert ON feedback_messages
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      sender_user_id = (SELECT public.educlub_user_id())
      AND sender_role = (SELECT public.educlub_role())
      AND (
        sender_role = 'learner'
        OR EXISTS (
          SELECT 1 FROM feedback_threads ft
          WHERE ft.id = thread_id
            AND sender_role IN ('school_admin', 'teacher')
            AND ft.school_id = (SELECT public.educlub_school_id())
        )
      )
    )
  );
CREATE POLICY feedback_messages_system_admin_delete ON feedback_messages
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS password_reset_tokens_owner_access ON password_reset_tokens;
CREATE POLICY password_reset_tokens_owner_access ON password_reset_tokens
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS password_reset_tokens_system_admin_write ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_system_admin_insert ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_system_admin_update ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_system_admin_delete ON password_reset_tokens;
CREATE POLICY password_reset_tokens_system_admin_insert ON password_reset_tokens
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY password_reset_tokens_system_admin_update ON password_reset_tokens
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY password_reset_tokens_system_admin_delete ON password_reset_tokens
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS trusted_mfa_devices_owner_access ON trusted_mfa_devices;
CREATE POLICY trusted_mfa_devices_owner_access ON trusted_mfa_devices
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS trusted_mfa_devices_system_admin_write ON trusted_mfa_devices;
DROP POLICY IF EXISTS trusted_mfa_devices_system_admin_insert ON trusted_mfa_devices;
DROP POLICY IF EXISTS trusted_mfa_devices_system_admin_update ON trusted_mfa_devices;
DROP POLICY IF EXISTS trusted_mfa_devices_system_admin_delete ON trusted_mfa_devices;
CREATE POLICY trusted_mfa_devices_system_admin_insert ON trusted_mfa_devices
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY trusted_mfa_devices_system_admin_update ON trusted_mfa_devices
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY trusted_mfa_devices_system_admin_delete ON trusted_mfa_devices
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS mfa_settings_owner_access ON mfa_settings;
CREATE POLICY mfa_settings_owner_access ON mfa_settings
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
  );

DROP POLICY IF EXISTS mfa_settings_system_admin_write ON mfa_settings;
DROP POLICY IF EXISTS mfa_settings_system_admin_insert ON mfa_settings;
DROP POLICY IF EXISTS mfa_settings_system_admin_update ON mfa_settings;
DROP POLICY IF EXISTS mfa_settings_system_admin_delete ON mfa_settings;
CREATE POLICY mfa_settings_system_admin_insert ON mfa_settings
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY mfa_settings_system_admin_update ON mfa_settings
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY mfa_settings_system_admin_delete ON mfa_settings
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS system_settings_system_admin_access ON system_settings;
CREATE POLICY system_settings_system_admin_access ON system_settings
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS notifications_role_access ON notifications;
CREATE POLICY notifications_role_access ON notifications
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR user_id = (SELECT public.educlub_user_id())
    OR (
      role = (SELECT public.educlub_role())
      AND (
        (
          (SELECT public.educlub_role()) = 'system_admin'
          AND school_id IS NULL
        )
        OR (
          (SELECT public.educlub_role()) IN ('school_admin', 'teacher', 'learner')
          AND school_id = (SELECT public.educlub_school_id())
        )
      )
    )
  );

DROP POLICY IF EXISTS notifications_system_admin_insert ON notifications;
DROP POLICY IF EXISTS notifications_system_admin_update ON notifications;
DROP POLICY IF EXISTS notifications_system_admin_delete ON notifications;
CREATE POLICY notifications_system_admin_insert ON notifications
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY notifications_system_admin_update ON notifications
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY notifications_system_admin_delete ON notifications
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS competitions_role_read ON competitions;
CREATE POLICY competitions_role_read ON competitions
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR (
      (SELECT public.educlub_role()) IN ('school_admin', 'teacher', 'learner')
      AND is_active IS TRUE
    )
  );

DROP POLICY IF EXISTS competitions_system_admin_write ON competitions;
DROP POLICY IF EXISTS competitions_system_admin_insert ON competitions;
DROP POLICY IF EXISTS competitions_system_admin_update ON competitions;
DROP POLICY IF EXISTS competitions_system_admin_delete ON competitions;
CREATE POLICY competitions_system_admin_insert ON competitions
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competitions_system_admin_update ON competitions
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competitions_system_admin_delete ON competitions
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS competition_enrollments_role_access ON competition_enrollments;
CREATE POLICY competition_enrollments_role_access ON competition_enrollments
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
  );

DROP POLICY IF EXISTS competition_enrollments_owner_insert ON competition_enrollments;
DROP POLICY IF EXISTS competition_enrollments_owner_update ON competition_enrollments;
DROP POLICY IF EXISTS competition_enrollments_system_admin_delete ON competition_enrollments;
CREATE POLICY competition_enrollments_owner_insert ON competition_enrollments
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND (SELECT public.educlub_role()) = 'learner'
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY competition_enrollments_owner_update ON competition_enrollments
  FOR UPDATE
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  )
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY competition_enrollments_system_admin_delete ON competition_enrollments
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS competition_payments_role_access ON competition_payments;
CREATE POLICY competition_payments_role_access ON competition_payments
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS competition_payments_owner_insert ON competition_payments;
DROP POLICY IF EXISTS competition_payments_system_admin_update ON competition_payments;
DROP POLICY IF EXISTS competition_payments_system_admin_delete ON competition_payments;
CREATE POLICY competition_payments_owner_insert ON competition_payments
  FOR INSERT
  WITH CHECK (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );
CREATE POLICY competition_payments_system_admin_update ON competition_payments
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competition_payments_system_admin_delete ON competition_payments
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS competition_results_role_access ON competition_results;
CREATE POLICY competition_results_role_access ON competition_results
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
  );

DROP POLICY IF EXISTS competition_results_system_admin_insert ON competition_results;
DROP POLICY IF EXISTS competition_results_system_admin_update ON competition_results;
DROP POLICY IF EXISTS competition_results_system_admin_delete ON competition_results;
CREATE POLICY competition_results_system_admin_insert ON competition_results
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competition_results_system_admin_update ON competition_results
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competition_results_system_admin_delete ON competition_results
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

DROP POLICY IF EXISTS competition_reminders_role_access ON competition_reminders;
CREATE POLICY competition_reminders_role_access ON competition_reminders
  FOR SELECT
  USING (
    (SELECT public.educlub_role()) = 'system_admin'
    OR EXISTS (
      SELECT 1 FROM learners l
      WHERE l.id = learner_id
        AND l.user_id = (SELECT public.educlub_user_id())
    )
  );

DROP POLICY IF EXISTS competition_reminders_system_admin_insert ON competition_reminders;
DROP POLICY IF EXISTS competition_reminders_system_admin_update ON competition_reminders;
DROP POLICY IF EXISTS competition_reminders_system_admin_delete ON competition_reminders;
CREATE POLICY competition_reminders_system_admin_insert ON competition_reminders
  FOR INSERT
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competition_reminders_system_admin_update ON competition_reminders
  FOR UPDATE
  USING ((SELECT public.educlub_role()) = 'system_admin')
  WITH CHECK ((SELECT public.educlub_role()) = 'system_admin');
CREATE POLICY competition_reminders_system_admin_delete ON competition_reminders
  FOR DELETE
  USING ((SELECT public.educlub_role()) = 'system_admin');

-- Create production admin accounts with scripts/seed-admin.js and environment
-- variables; never keep default credentials in schema migrations.
