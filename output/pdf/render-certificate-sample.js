const fs = require("fs");
const vm = require("vm");
const { createRequire } = require("module");
const servicePath = "C:/educlub_lightweight/backend/src/services/certificates.service.js";
const backendRequire = createRequire(servicePath);
function sandboxRequire(id) {
  if (id === "../config") return { query: async () => ({ rows: [] }) };
  return backendRequire(id);
}
const code = fs.readFileSync(servicePath, "utf8") + "\nmodule.exports.__buildCertificatePdf = buildCertificatePdf;";
const sandbox = {
  require: sandboxRequire,
  module: { exports: {} },
  exports: {},
  __dirname: "C:/educlub_lightweight/backend/src/services",
  console,
  Buffer,
  URL,
};
vm.runInNewContext(code, sandbox, { filename: servicePath });
const certificate = {
  id: 1024,
  school_name: "Bright Junior Academy",
  school_logo_url: null,
  learner_name: "Charles Wagura",
  course_name: "Web Development Foundations",
  term: "Term 2",
  academic_year: 2026,
  issued_date: new Date("2026-06-29T09:00:00Z").toISOString(),
};
sandbox.module.exports.__buildCertificatePdf(certificate).then((buffer) => {
  fs.writeFileSync("C:/educlub_lightweight/output/pdf/educlub-certificate-premium-sample.pdf", buffer);
  console.log(buffer.length);
}).catch((error) => { console.error(error); process.exit(1); });
