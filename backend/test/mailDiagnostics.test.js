const test = require("node:test");
const assert = require("node:assert/strict");

const {
  describeMailSettings,
  explainMailFailure,
  formatMailReport,
  printMailAdvice,
  printMailReport,
  reportMailStartup,
} = require("../src/utils/mailDiagnostics");

// The shape config/env exports, so these run against what the scripts really pass in.
const mailEnv = (overrides = {}) => ({
  emailHost: "mail.educlub.co.ke",
  emailPort: 465,
  emailSecure: true,
  emailUser: "support@educlub.co.ke",
  emailPassword: "S3cret-pass",
  emailFrom: "eduClub <support@educlub.co.ke>",
  emailReplyTo: "support@educlub.co.ke",
  envFile: "/srv/app/.env",
  envFileFound: true,
  envShadowedKeys: [],
  envReplacedKeys: [],
  ...overrides,
});

test("the mail report says what is in use and never prints the password", () => {
  const report = formatMailReport(mailEnv()).join("\n");

  assert.match(report, /mail\.educlub\.co\.ke:465 \(SSL\/TLS\)/);
  assert.match(report, /support@educlub\.co\.ke \(password: 11 characters\)/);
  assert.match(report, /Sending as : eduClub <support@educlub\.co\.ke>/);
  assert.match(report, /Reply-To   : support@educlub\.co\.ke/);
  assert.match(report, /Read from  : \/srv\/app\/\.env/);

  assert.doesNotMatch(report, /S3cret-pass/);
  assert.doesNotMatch(JSON.stringify(describeMailSettings(mailEnv())), /S3cret-pass/);
});

test("with no Reply-To configured the report says so instead of inventing one", () => {
  const report = formatMailReport(mailEnv({ emailReplyTo: "" })).join("\n");
  assert.match(report, /Reply-To   : \(none\)/);
});

test("mail settings that were also set in the environment are named as ignored", () => {
  const report = formatMailReport(
    mailEnv({ envReplacedKeys: ["EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_FROM"] }),
  ).join("\n");

  // The file won, so this is a note about stale copies and not a fault.
  assert.match(report, /Ignored    : EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM - Also set in the environment/);
  assert.match(report, /those values are ignored/);
  assert.doesNotMatch(report, /S3cret-pass/);

  // The rest of the configuration is not this report's business.
  const other = formatMailReport(mailEnv({ envShadowedKeys: ["DATABASE_URL"] })).join("\n");
  assert.doesNotMatch(other, /DATABASE_URL|Ignored/);
});

test("nothing is reported as ignored when nothing was", () => {
  assert.doesNotMatch(formatMailReport(mailEnv()).join("\n"), /Ignored/);
});

test("a missing .env file is reported as such", () => {
  const report = formatMailReport(mailEnv({ envFileFound: false })).join("\n");
  assert.match(report, /\/srv\/app\/\.env \(no such file\)/);
});

test("whitespace and quotes in the password are called out, since they change the login", () => {
  const spaced = describeMailSettings(mailEnv({ emailPassword: "abcd efgh" }));
  assert.equal(spaced.notes.length, 1);
  assert.match(spaced.notes[0], /whitespace/);

  const quoted = describeMailSettings(mailEnv({ emailPassword: '"hunter22"' }));
  assert.match(quoted.notes.join(" "), /wrapped in quotes/);

  assert.deepEqual(describeMailSettings(mailEnv()).notes, []);
});

test("a sender realigned onto the login's domain is explained in the report", () => {
  const report = formatMailReport(
    mailEnv({ emailUser: "school@gmail.com", emailFrom: "eduClub <noreply@educlub.com>" }),
  ).join("\n");

  assert.match(report, /Sending as : eduClub <school@gmail\.com>/);
  assert.match(report, /Note       : EMAIL_FROM is not on the domain of EMAIL_USER/);
});

test("a refused login is explained in terms of the mailbox and the password", () => {
  const lines = explainMailFailure(
    { code: "EAUTH", message: "Invalid login: 535 Incorrect authentication data" },
    mailEnv(),
  );
  const text = lines.join("\n");

  assert.match(text, /mail\.educlub\.co\.ke:465\) refused the login for support@educlub\.co\.ke/);
  assert.match(text, /forwarder/);
  assert.match(text, /current password/);
  assert.match(text, /after a restart/);
});

test("a 535 is recognised even when it arrives without the EAUTH code", () => {
  const lines = explainMailFailure(
    { code: "unknown", message: "535 Incorrect authentication data" },
    mailEnv(),
  );
  assert.match(lines.join("\n"), /refused the login/);
});

test("connection failures point at host, port and certificate rather than the password", () => {
  const certificate = explainMailFailure(
    { code: "ESOCKET", message: "Hostname/IP does not match certificate's altnames" },
    mailEnv(),
  ).join("\n");
  assert.match(certificate, /Could not complete a connection to mail\.educlub\.co\.ke:465/);
  assert.match(certificate, /EMAIL_TLS_SERVERNAME/);
  assert.doesNotMatch(certificate, /password/i);

  const timeout = explainMailFailure(
    { code: "ETIMEDOUT", message: "Greeting never received" },
    mailEnv(),
  ).join("\n");
  assert.match(timeout, /EMAIL_HOST and EMAIL_PORT/);
  assert.doesNotMatch(timeout, /EMAIL_TLS_SERVERNAME/);
});

test("a message refused after a good login is not blamed on the password", () => {
  const text = explainMailFailure(
    { code: "EENVELOPE", message: "Mail command failed: 550 Sender verify failed" },
    mailEnv(),
  ).join("\n");

  assert.match(text, /accepted the login but refused the message/);
  assert.match(text, /same domain as EMAIL_USER/);
  assert.doesNotMatch(text, /password/i);
});

test("an error it does not recognise gets no invented advice", () => {
  assert.deepEqual(
    explainMailFailure({ code: "EWHATEVER", message: "something odd" }, mailEnv()),
    [],
  );
  assert.deepEqual(explainMailFailure(null, mailEnv()), []);
});

// reportMailStartup: what the running application writes to its log.
function startupLog(env, loginResult) {
  const entries = [];
  const log = {
    info: (message, meta) => entries.push({ level: "info", message, ...meta }),
    warn: (message, meta) => entries.push({ level: "warn", message, ...meta }),
  };
  return reportMailStartup({ env, log, verifyLogin: async () => loginResult }).then(() => entries);
}

test("startup logs what the process is using and that the login works", async () => {
  const entries = await startupLog(mailEnv(), { ok: true });
  const byMessage = Object.fromEntries(entries.map((entry) => [entry.message, entry]));

  assert.deepEqual(entries.map((entry) => entry.message), ["email_identity", "email_login_ok"]);
  assert.equal(byMessage.email_identity.user, "support@educlub.co.ke");
  assert.equal(byMessage.email_identity.host, "mail.educlub.co.ke");
  assert.equal(byMessage.email_identity.port, 465);
  assert.equal(byMessage.email_identity.from, "eduClub <support@educlub.co.ke>");
  assert.equal(byMessage.email_identity.passwordLength, 11);
  assert.equal(byMessage.email_login_ok.user, "support@educlub.co.ke");
});

test("startup names every setting where the process environment beat .env", async () => {
  const entries = await startupLog(
    mailEnv({ envShadowedKeys: ["DATABASE_URL", "JWT_SECRET"] }),
    { ok: true },
  );
  const warning = entries.find((entry) => entry.message === "env_overridden_by_process_environment");

  assert.equal(warning.level, "warn");
  assert.deepEqual(warning.keys, ["DATABASE_URL", "JWT_SECRET"]);
  assert.equal(warning.envFile, "/srv/app/.env");
});

test("startup names the mail settings the environment also set, which .env overrode", async () => {
  const entries = await startupLog(
    mailEnv({ envReplacedKeys: ["EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_FROM"] }),
    { ok: true },
  );
  const note = entries.find((entry) => entry.message === "mail_settings_in_environment_ignored");

  assert.equal(note.level, "warn");
  assert.deepEqual(note.keys, ["EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_FROM"]);
  assert.match(note.reason, /Mail settings are read from \.env/);
  assert.ok(
    !entries.some((entry) => entry.message === "env_overridden_by_process_environment"),
    "the file won, so nothing was overridden",
  );
});

test("startup reports a refused login with the server's reply and what to check", async () => {
  const entries = await startupLog(mailEnv(), {
    ok: false,
    code: "EAUTH",
    message: "Invalid login: 535 Incorrect authentication data",
  });
  const failure = entries.find((entry) => entry.message === "email_login_failed");

  assert.equal(failure.level, "warn");
  assert.equal(failure.code, "EAUTH");
  assert.equal(failure.response, "Invalid login: 535 Incorrect authentication data");
  assert.equal(failure.user, "support@educlub.co.ke");
  assert.ok(failure.hints.length > 0);
  assert.ok(!entries.some((entry) => entry.message === "email_login_ok"));
});

test("nothing startup logs contains the password", async () => {
  const entries = await startupLog(
    mailEnv({ emailPassword: '"S3cret-pass"', envReplacedKeys: ["EMAIL_PASSWORD"] }),
    { ok: false, code: "EAUTH", message: "Invalid login: 535 Incorrect authentication data" },
  );

  assert.doesNotMatch(JSON.stringify(entries), /S3cret-pass/);
  // The quoted value is worth a warning of its own, since it changes the login.
  assert.ok(entries.some((entry) => entry.message === "email_setting_note"));
});

test("startup says when the sender had to be moved onto the login's domain", async () => {
  const entries = await startupLog(
    mailEnv({ emailUser: "school@gmail.com", emailFrom: "eduClub <noreply@educlub.com>" }),
    { ok: true },
  );
  const moved = entries.find((entry) => entry.message === "email_from_realigned");

  assert.equal(moved.configuredFrom, "noreply@educlub.com");
  assert.equal(moved.sendingAs, "school@gmail.com");
});

test("the host's hourly sending limit is recognised, and not blamed on the settings", () => {
  const text = explainMailFailure(
    {
      code: "EENVELOPE",
      message:
        "Mail command failed: 550 Domain educlub.co.ke has exceeded the max emails per hour (100/100 (100%)) allowed. Message discarded.",
    },
    mailEnv(),
  ).join("\n");

  assert.match(text, /hourly sending limit/);
  assert.match(text, /settings are fine/);
  assert.doesNotMatch(text, /password/i);
});

test("the scripts print exactly the report and the advice the rest of the code produces", () => {
  const printed = [];
  printMailReport(mailEnv(), (text) => printed.push(text));
  assert.deepEqual(printed, [`${formatMailReport(mailEnv()).join("\n")}\n`]);

  const failure = { code: "EAUTH", message: "Invalid login: 535 Incorrect authentication data" };
  const advice = [];
  printMailAdvice(failure, mailEnv(), (line) => advice.push(line));
  assert.deepEqual(advice, explainMailFailure(failure, mailEnv()));

  const nothing = [];
  printMailAdvice({ code: "EWHATEVER", message: "odd" }, mailEnv(), (line) => nothing.push(line));
  assert.deepEqual(nothing, []);
});
