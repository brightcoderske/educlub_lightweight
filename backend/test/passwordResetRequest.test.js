const test = require("node:test");
const assert = require("node:assert/strict");

// The public "forgot password" page answers the same thing whatever happens, on
// purpose, so that it cannot be used to find out who has an account. That makes
// every way of ending up without an email look identical to the person waiting
// for one. These tests pin down that each way is different to the operator: it
// is logged, and for an account that exists it is recorded in audit_logs.
//
// The database and the mailer are replaced before the service is loaded, because
// the service takes its dependencies at load time.
const config = require("../src/config");
const emailModule = require("../src/utils/email");
const logger = require("../src/utils/logger");
const env = require("../src/config/env");

const seen = { queries: [], audit: [], logs: [], sent: [] };
let accounts = [];
let sendResult = true;
let failureCode = "EAUTH";
let auditFails = false;

config.query = async (text, params) => {
  seen.queries.push(text);
  if (/FROM users/i.test(text)) return { rows: accounts, rowCount: accounts.length };
  if (/INSERT INTO audit_logs/i.test(text)) {
    if (auditFails) throw new Error("audit table is unavailable");
    seen.audit.push({ userId: params[0], action: params[1], detail: JSON.parse(params[2]) });
  }
  return { rows: [], rowCount: 0 };
};
emailModule.sendPasswordResetLinkEmail = async (to, name, url, minutes) => {
  seen.sent.push({ to, name, url, minutes });
  return sendResult;
};
emailModule.getLastEmailFailure = () => ({ code: failureCode });
logger.info = (message, meta) => seen.logs.push({ level: "info", message, ...meta });
logger.warn = (message, meta) => seen.logs.push({ level: "warn", message, ...meta });

const authService = require("../src/services/auth.service");

function reset({ users = [], sends = true } = {}) {
  seen.queries.length = 0;
  seen.audit.length = 0;
  seen.logs.length = 0;
  seen.sent.length = 0;
  accounts = users;
  sendResult = sends;
  failureCode = "EAUTH";
  auditFails = false;
}

const admin = {
  id: 9,
  email: "admin@example.test",
  full_name: "Admin User",
  role: "system_admin",
  school_id: null,
  username: "admin",
};
const learnerWithPlaceholder = {
  id: 7,
  email: "annamani@learners.educlub.local",
  full_name: "Anna Mani",
  role: "learner",
  school_id: 3,
  username: "annamani",
};

const request = (identifier) => authService.requestPasswordReset(identifier, "203.0.113.5", "test-agent");
const logNamed = (message) => seen.logs.find((entry) => entry.message === message);

test("whatever happens, the person is given the same answer", async (t) => {
  t.mock.method(console, "error", () => {});
  const answers = new Set();

  for (const scenario of [
    { users: [] },
    { users: [learnerWithPlaceholder] },
    { users: [admin], sends: true },
    { users: [admin], sends: false },
  ]) {
    reset(scenario);
    answers.add((await request("someone")).message);
  }

  assert.equal(answers.size, 1, "the page must not reveal which case it was");
});

test("an address no active account has is skipped, and only the log knows", async () => {
  reset({ users: [] });
  await request("muchirifloy@gmail.com");

  assert.equal(seen.sent.length, 0);
  assert.equal(seen.audit.length, 0, "an unknown address must not be able to write audit rows");
  const skipped = logNamed("password_reset_skipped");
  assert.equal(skipped.reason, "no_active_account");
  // Enough to recognise what was typed, without keeping an address in full.
  assert.equal(skipped.requested, "mu***@gmail.com");
  assert.doesNotMatch(JSON.stringify(seen.logs), /muchirifloy/);
});

test("an account whose address is only a placeholder is skipped, and recorded", async () => {
  reset({ users: [learnerWithPlaceholder] });
  await request("annamani");

  assert.equal(seen.sent.length, 0, "nothing can be delivered to @learners.educlub.local");
  assert.deepEqual(seen.audit, [
    { userId: 7, action: "password_reset_skipped_no_email", detail: { role: "learner" } },
  ]);
  assert.equal(logNamed("password_reset_skipped").reason, "no_deliverable_email");
});

test("an account with a real address is emailed a one-use link, and the send is recorded", async () => {
  reset({ users: [admin] });
  await request("admin@example.test");

  assert.equal(seen.sent.length, 1);
  const [message] = seen.sent;
  assert.equal(message.to, "admin@example.test");
  assert.match(
    message.url,
    new RegExp(`^${env.frontendUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/authentication/set-password\\?token=[a-f0-9]{64}$`),
  );
  assert.equal(message.minutes, 30);

  assert.ok(
    seen.queries.some((sql) => /INSERT INTO password_reset_tokens/i.test(sql)),
    "the token must be stored before the link is sent",
  );
  assert.deepEqual(seen.audit, [{ userId: 9, action: "password_reset_email_sent", detail: {} }]);
  assert.equal(logNamed("password_reset_link_sent").userId, 9);
});

test("a send the mail server refuses is still answered the same, and is recorded with its code", async (t) => {
  t.mock.method(console, "error", () => {});
  reset({ users: [admin], sends: false });
  failureCode = "EAUTH";

  const answer = await request("admin");

  assert.match(answer.message, /If the account has a reachable email address/);
  assert.equal(seen.audit.length, 1);
  assert.equal(seen.audit[0].action, "password_reset_email_failed");
  assert.equal(seen.audit[0].detail.mailCode, "EAUTH");
  assert.match(seen.audit[0].detail.reason, /could not be emailed/);
  const failed = logNamed("password_reset_failed");
  assert.equal(failed.level, "warn");
  assert.equal(failed.mailCode, "EAUTH");
});

test("a failure to record the outcome never changes what the person is told", async (t) => {
  const errors = t.mock.method(console, "error", () => {});
  reset({ users: [admin] });
  auditFails = true;

  const answer = await request("admin@example.test");

  assert.match(answer.message, /If the account has a reachable email address/);
  assert.equal(seen.sent.length, 1, "the email was still sent");
  assert.equal(seen.audit.length, 0, "and the audit row genuinely failed to write");
  assert.ok(
    errors.mock.calls.some((call) => /Could not record the password reset outcome/.test(call.arguments[0])),
    "the failure is reported to the operator instead of swallowed",
  );
});

test("an administrator asking for a link that cannot be emailed is told so plainly", async () => {
  reset({ users: [admin], sends: false });
  failureCode = "ECONNECTION";

  await assert.rejects(
    () => authService.sendPasswordResetLinkForUser(admin, 1, "203.0.113.5", "test-agent"),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /could not be emailed/);
      assert.match(error.message, /not working right now/);
      assert.equal(error.mailCode, "ECONNECTION");
      return true;
    },
  );
});

test("an account with no reachable address is a client error, not a server fault", async () => {
  reset();

  await assert.rejects(
    () => authService.sendPasswordResetLinkForUser(learnerWithPlaceholder, 1, "203.0.113.5", "ua"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /does not have a reachable email address/);
      return true;
    },
  );
  assert.equal(seen.sent.length, 0);
});
