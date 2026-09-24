#!/usr/bin/env node
/**
 * Sends one real email, to prove delivery end to end.
 *
 * `npm run email:verify` only proves the SMTP login works. It cannot tell you
 * that a message actually lands in an inbox, which is the failure this exists
 * to catch: a From address the mail account cannot authenticate for is accepted
 * by the server and then dropped or filed as spam by the recipient.
 *
 * It opens by printing the settings it is using. A failed test is usually a
 * test run with different settings from the ones being looked at, and the
 * quickest way to see that is to have the output say what it used.
 *
 * Usage: npm run email:test -- you@example.com
 */
const path = require("path");
require("../src/config/loadEnv").loadEnv(path.resolve(__dirname, "../.env"));

const env = require("../src/config/env");
const { deliver, getMailIdentity, getLastEmailFailure } = require("../src/utils/email");
const {
  describeMailSettings,
  explainMailFailure,
  formatMailReport,
} = require("../src/utils/mailDiagnostics");

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Usage: npm run email:test -- you@example.com");
    process.exit(1);
  }

  console.log(formatMailReport(env).join("\n"));
  console.log("");

  const identity = getMailIdentity();
  const sent = await deliver(
    {
      from: identity.from,
      ...(identity.replyTo ? { replyTo: identity.replyTo } : {}),
      to,
      subject: "eduClub - delivery test",
      text:
        "This is a delivery test from eduClub.\n\n" +
        "If you can read this in your inbox (not spam), password reset links, " +
        "verification codes and welcome emails will arrive too.",
    },
    "Delivery test",
  );

  if (!sent) {
    console.error("The transport refused the message. The error is logged above.");
    for (const line of explainMailFailure(getLastEmailFailure(), describeMailSettings(env))) {
      console.error(line);
    }
    process.exit(1);
  }
  console.log("Accepted by the mail server. Check the inbox, and the spam folder.");
}

main().then(() => process.exit(0));
