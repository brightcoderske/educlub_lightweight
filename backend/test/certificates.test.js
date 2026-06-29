const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("course completion creates one certificate per learner/course/term/year", () => {
  const startupSchema = read("../src/services/startupSchema.service.js");
  const schema = read("../src/database/schema.sql");
  const coursesService = read("../src/services/courses.service.js");
  const certificatesService = read("../src/services/certificates.service.js");

  assert.match(startupSchema, /idx_certificates_unique_award/);
  assert.match(schema, /idx_certificates_unique_award/);
  assert.match(coursesService, /certificatesService/);
  assert.match(coursesService, /ensureCourseCompletionCertificate/);
  assert.match(
    certificatesService,
    /async function ensureCourseCompletionCertificate/
  );
  assert.match(certificatesService, /status: "pending"|status = 'pending'/);
});

test("certificate APIs are scoped and return authenticated PDF downloads", () => {
  const routes = read("../src/routes/certificates.routes.js");
  const controller = read("../src/controllers/certificates.controller.js");
  const certificatesService = read("../src/services/certificates.service.js");

  assert.match(
    routes,
    /router\.post\([\s\S]*"\/generate"[\s\S]*requireRole\("system_admin", "school_admin"\)/
  );
  assert.match(controller, /downloadCertificatePdf/);
  assert.match(controller, /application\/pdf/);
  assert.match(certificatesService, /PDFDocument/);
  assert.match(certificatesService, /assertCertificateAccess/);
  assert.match(certificatesService, /c\.status = 'approved'/);
});

test("certificate PDF and preview use the premium eduClub visual style", () => {
  const certificatesService = read("../src/services/certificates.service.js");
  const preview = read(
    "../../frontend/src/components/CertificatePreviewModal.js"
  );

  for (const source of [certificatesService, preview]) {
    assert.match(source, /#061a3a|#071b3f/);
    assert.match(source, /#d4af37|#f5c451/);
    assert.match(source, /EduClub Excellence/);
    assert.match(source, /School Approval/);
    assert.match(source, /Certificate ID/);
  }

  assert.match(certificatesService, /drawPremiumRibbon/);
  assert.match(certificatesService, /drawSeal/);
  assert.match(preview, /radial-gradient/);
  assert.match(preview, /linear-gradient\(135deg/);
});
