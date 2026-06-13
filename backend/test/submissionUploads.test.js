const test = require("node:test");
const assert = require("node:assert/strict");

Object.assign(process.env, {
  DATABASE_URL: "postgres://localhost/educlub_test",
  JWT_SECRET: "test-secret",
  EMAIL_HOST: "localhost",
  EMAIL_PORT: "1025",
  EMAIL_USER: "test@example.com",
  EMAIL_PASSWORD: "test-password",
  DEFAULT_ADMIN_PASSWORD: "test-password",
  DEFAULT_SCHOOL_ADMIN_PASSWORD: "test-password",
  DEFAULT_LEARNER_PASSWORD: "test-password",
  SYSTEM_ADMIN_EMAIL: "admin@example.com",
  FRONTEND_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3000",
});

const {
  isAllowedSubmissionFile,
} = require("../src/controllers/courses.controller");

test("accepts Scratch files from common browser MIME types", () => {
  for (const mimeType of [
    "application/x.scratch.sb3",
    "application/zip",
    "application/octet-stream",
  ]) {
    assert.equal(isAllowedSubmissionFile("maze.sb3", mimeType), true);
  }
});

test("accepts existing submission document and image types", () => {
  assert.equal(isAllowedSubmissionFile("notes.pdf", "application/pdf"), true);
  assert.equal(isAllowedSubmissionFile("screenshot.png", "image/png"), true);
  assert.equal(isAllowedSubmissionFile("answer.txt", "text/plain"), true);
});

test("does not accept arbitrary zip or binary files as Scratch projects", () => {
  assert.equal(isAllowedSubmissionFile("archive.zip", "application/zip"), false);
  assert.equal(
    isAllowedSubmissionFile("program.exe", "application/octet-stream"),
    false,
  );
});

test("requires an allowed Scratch MIME type for sb3 files", () => {
  assert.equal(isAllowedSubmissionFile("maze.sb3", "text/plain"), false);
});
