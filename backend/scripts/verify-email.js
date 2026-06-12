const nodemailer = require("nodemailer");
const env = require("../src/config/env");
const { buildTransportOptions } = require("../src/utils/emailConfig");

async function verifyEmail() {
  const transporter = nodemailer.createTransport(buildTransportOptions(env));
  await transporter.verify();
  console.log("SMTP connection and authentication verified.");
}

verifyEmail().catch((error) => {
  const code = String(error?.code || "UNKNOWN").replace(/[^A-Z0-9_-]/gi, "");
  console.error(`SMTP verification failed (${code || "UNKNOWN"}).`);
  process.exit(1);
});
