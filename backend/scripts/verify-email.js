#!/usr/bin/env node
/**
 * Proves the SMTP connection and login work, without sending anything.
 *
 * It opens by printing the settings it is using, and on failure it prints the
 * server's own reply and what to check. Both matter more than the error code:
 * "EAUTH" alone cannot tell a wrong password from settings that were never the
 * ones intended.
 *
 * Usage: npm run email:verify
 */
const path = require("path");
require("../src/config/loadEnv").loadEnv(path.resolve(__dirname, "../.env"));

const env = require("../src/config/env");
const { verifyMailLogin } = require("../src/utils/email");
const { printMailAdvice, printMailReport } = require("../src/utils/mailDiagnostics");

async function main() {
  printMailReport(env);

  const result = await verifyMailLogin();
  if (result.ok) {
    console.log("SMTP connection and authentication verified.");
    return 0;
  }

  console.error(`SMTP verification failed [${result.code}]: ${result.message}`);
  printMailAdvice(result, env);
  return 1;
}

main().then((code) => process.exit(code));
