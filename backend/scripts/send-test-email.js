#!/usr/bin/env node
/**
 * Sends one real email, to prove delivery end to end.
 *
 * `npm run mail:verify` only proves the SMTP login works. It cannot tell you
 * that a message actually lands in an inbox, which is the failure this exists
 * to catch: a From address the mail account cannot authenticate for is accepted
 * by the server and then dropped or filed as spam by the recipient.
 *
 * Usage: npm run email:test -- you@example.com
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { deliver, getMailIdentity } = require("../src/utils/email");

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Usage: npm run email:test -- you@example.com");
    process.exit(1);
  }

  const identity = getMailIdentity();
  console.log("Sending as :", identity.from);
  console.log("Reply-To   :", identity.replyTo || "(none)");
  if (!identity.aligned) {
    console.log(
      `Note       : EMAIL_FROM (${identity.configuredFrom}) is not the mailbox that ` +
        `authenticates (${identity.authenticated}), so it is used as Reply-To instead. ` +
        "Verify it as an alias with your mail provider to send from it.",
    );
  }

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
    process.exit(1);
  }
  console.log("Accepted by the mail server. Check the inbox, and the spam folder.");
}

main().then(() => process.exit(0));
