const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { UPLOADS_ROOT, uploadUrl, uploadLocalPath } = require("../src/utils/uploads");

test("an upload is stored as its path alone, never with a host", () => {
  assert.equal(uploadUrl("/uploads/school-logos/a.png"), "/uploads/school-logos/a.png");
  assert.equal(uploadUrl("\\uploads\\school-logos\\a.png"), "/uploads/school-logos/a.png");
});

test("PDFs find the file behind a path and behind an older full address", () => {
  const expected = path.join(UPLOADS_ROOT, "school-logos", "a.png");
  assert.equal(uploadLocalPath("/uploads/school-logos/a.png"), expected);
  assert.equal(uploadLocalPath("https://learn.educlub.co.ke/uploads/school-logos/a.png"), expected);
});

test("a stored address can never reach outside the uploads folder", () => {
  for (const value of [
    "/uploads/../.env",
    "/uploads/%2e%2e/.env",
    "https://educlub.co.ke/uploads/../src/server.js",
    "/etc/passwd",
    "not a url",
    null,
  ]) {
    assert.equal(uploadLocalPath(value), null, String(value));
  }
});
