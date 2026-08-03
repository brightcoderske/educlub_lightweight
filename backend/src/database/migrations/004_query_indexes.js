module.exports = {
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_school_admins_school ON school_admins(school_id);
      CREATE INDEX IF NOT EXISTS idx_courses_template ON courses(template_id);
      CREATE INDEX IF NOT EXISTS idx_course_modules_template_module ON course_modules(template_module_id);
      CREATE INDEX IF NOT EXISTS idx_learning_activities_template_activity ON learning_activities(template_activity_id);
      CREATE INDEX IF NOT EXISTS idx_activity_grades_submission ON activity_grades(submission_id);
      CREATE INDEX IF NOT EXISTS idx_availability_overrides_school_module ON learning_availability_overrides(school_id, module_id);
      CREATE INDEX IF NOT EXISTS idx_availability_overrides_activity ON learning_availability_overrides(activity_id);
      CREATE INDEX IF NOT EXISTS idx_learner_badges_course_module ON learner_module_badges(course_id, module_id);
      CREATE INDEX IF NOT EXISTS idx_module_feedback_course_module ON module_feedback(course_id, module_id);
      CREATE INDEX IF NOT EXISTS idx_discussions_created_by ON discussions(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_discussion_replies_learner ON discussion_replies(learner_id);
      CREATE INDEX IF NOT EXISTS idx_discussion_replies_parent ON discussion_replies(parent_reply_id);
      CREATE INDEX IF NOT EXISTS idx_grades_cache_course ON grades_cache(course_id);
      CREATE INDEX IF NOT EXISTS idx_progress_cache_course ON progress_cache(course_id);
      CREATE INDEX IF NOT EXISTS idx_typing_tests_school_competition ON typing_tests(school_id, competition_id);
      CREATE INDEX IF NOT EXISTS idx_typing_attempts_learner ON typing_attempts(learner_id);
      CREATE INDEX IF NOT EXISTS idx_course_payments_learner_course ON course_payments(learner_id, course_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_tests_school ON quiz_tests(school_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_test_attempts_learner ON quiz_test_attempts(learner_id);
      CREATE INDEX IF NOT EXISTS idx_reports_course ON reports(course_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_threads_learner ON feedback_threads(learner_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_school_created ON notifications(school_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_competition_payments_learner_competition ON competition_payments(learner_id, competition_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_replacement ON user_sessions(replaced_by_session_id);
    `);
  },
};
