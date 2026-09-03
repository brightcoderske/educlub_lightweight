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
const { decodeProfilePhoto } = require("../src/services/auth.service");

test("profile photos accept bounded PNGs and explicit removal", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=";
  const photo = decodeProfilePhoto(`data:image/png;base64,${png}`);
  assert.equal(photo.extension, "png");
  assert.ok(Buffer.isBuffer(photo.buffer));
  assert.equal(decodeProfilePhoto(null), null);
});

test("profile photos reject disguised files, oversized payloads, and missing data", () => {
  for (const value of [undefined, {}, "", "https://example.com/photo.jpg",
    "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,PHNjcmlwdD4=",
    `data:image/jpeg;base64,${"A".repeat(350000)}`]) {
    assert.throws(() => decodeProfilePhoto(value), { statusCode: 400 });
  }
});

test("profile photos reject a PNG with excessive decoded dimensions or mismatched MIME", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=", "base64");
  assert.throws(() => decodeProfilePhoto(`data:image/jpeg;base64,${png.toString("base64")}`), { statusCode: 400 });
  png.writeUInt32BE(9000, 16);
  assert.throws(() => decodeProfilePhoto(`data:image/png;base64,${png.toString("base64")}`), { statusCode: 400 });
});

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
