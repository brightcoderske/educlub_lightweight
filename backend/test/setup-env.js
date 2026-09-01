process.env.NODE_ENV = "test";
// src/config/db.js only honours DATABASE_URL when it names the mysql scheme,
// and otherwise falls back to the discrete MYSQL_* settings. A postgresql://
// default here was silently ignored rather than pointing anywhere real.
process.env.DATABASE_URL ||= "mysql://educlub_test:educlub_test@127.0.0.1:3306/educlub_test";
process.env.JWT_SECRET ||= "test-only-jwt-secret-that-is-longer-than-thirty-two-characters";
process.env.EMAIL_HOST ||= "localhost";
process.env.EMAIL_PORT ||= "1025";
process.env.EMAIL_USER ||= "test@educlub.invalid";
process.env.EMAIL_PASSWORD ||= "test-only-password";
process.env.DEFAULT_ADMIN_PASSWORD ||= "TestAdminPassword1!";
process.env.DEFAULT_SCHOOL_ADMIN_PASSWORD ||= "TestSchoolAdminPassword1!";
process.env.DEFAULT_LEARNER_PASSWORD ||= "TestLearnerPassword1!";
process.env.SYSTEM_ADMIN_EMAIL ||= "admin@educlub.invalid";
process.env.FRONTEND_URL ||= "http://localhost:3000";
process.env.CORS_ORIGINS ||= "http://localhost:3000";
