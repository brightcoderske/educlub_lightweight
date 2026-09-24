const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { findShadowedKeys } = require("../src/config/loadEnv");

const SRC = path.join(__dirname, "..", "src");

test("only variables whose process value differs from .env are reported", () => {
  const fileValues = {
    EMAIL_USER: "a@x.test",
    EMAIL_HOST: "h.test",
    PORT: "4000",
    EMAIL_FROM: "f@x.test",
    ONLY_IN_FILE: "v",
  };
  const processEnv = {
    EMAIL_USER: "b@x.test", // set elsewhere to something else: shadowed
    EMAIL_HOST: "h.test", // set elsewhere to the same thing: nothing to report
    PORT: "", // set, but empty, so .env is ignored for it: shadowed
    EMAIL_FROM: undefined, // not set, so .env supplies it: nothing to report
  };

  assert.deepEqual(findShadowedKeys(fileValues, processEnv), ["EMAIL_USER", "PORT"]);
});

// The loader remembers its first read, so anything that exercises it needs a
// process of its own. Only a minimal environment is passed down, otherwise the
// developer's own settings would leak into what is being asserted.
function minimalEnv(extra = {}) {
  return { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extra };
}

function inFreshProcess(script, { cwd, env }) {
  const output = execFileSync(process.execPath, ["-e", script], {
    cwd,
    env,
    encoding: "utf8",
  });
  return JSON.parse(output.trim().split("\n").pop());
}

function scratchDirectory(t, envFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "educlub-env-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (envFile !== undefined) fs.writeFileSync(path.join(dir, ".env"), envFile);
  return dir;
}

const loadScript = (body) =>
  `const { loadEnv } = require(${JSON.stringify(path.join(SRC, "config", "loadEnv"))});${body}`;

test("for settings other than mail, a value in the process environment beats .env, and the clash is recorded", (t) => {
  const dir = scratchDirectory(t, "APP_SETTING=from-file\nOTHER_SETTING=other-from-file\n");
  const script = loadScript(
    "const first = loadEnv();" +
      'const again = loadEnv("/somewhere/else/.env");' +
      "console.log(JSON.stringify({ first, sameAnswer: first === again," +
      " setting: process.env.APP_SETTING, other: process.env.OTHER_SETTING }));",
  );

  const result = inFreshProcess(script, {
    cwd: dir,
    env: minimalEnv({ APP_SETTING: "from-panel" }),
  });

  assert.deepEqual(result.first.shadowed, ["APP_SETTING"]);
  assert.deepEqual(result.first.replaced, []);
  assert.equal(result.first.found, true);
  // dotenv never overrides, so the panel value is what the application would use.
  assert.equal(result.setting, "from-panel");
  // What the process does not define still comes from .env.
  assert.equal(result.other, "other-from-file");
  // The first read is the one that saw the disagreement, so it is the one kept.
  assert.equal(result.sameAnswer, true);
});

test("for the mail settings .env wins, so a stale copy in the environment cannot beat it", (t) => {
  // What was actually found on the server: the mailbox and password in .env were
  // right, and stale copies exported elsewhere kept winning, so the login went
  // on being refused however many times .env was corrected.
  const dir = scratchDirectory(
    t,
    "EMAIL_USER=support@x.test\nEMAIL_PASSWORD=new-password\nEMAIL_HOST=mail.x.test\nAPP_SETTING=from-file\n",
  );
  const script = loadScript(
    "const loaded = loadEnv();" +
      "console.log(JSON.stringify({ loaded, user: process.env.EMAIL_USER," +
      " password: process.env.EMAIL_PASSWORD, host: process.env.EMAIL_HOST," +
      " setting: process.env.APP_SETTING }));",
  );

  const result = inFreshProcess(script, {
    cwd: dir,
    env: minimalEnv({
      EMAIL_USER: "noreply@x.test",
      EMAIL_PASSWORD: "old-password",
      EMAIL_HOST: "mail.x.test", // the same value: nothing to report
      APP_SETTING: "from-panel",
    }),
  });

  assert.equal(result.user, "support@x.test");
  assert.equal(result.password, "new-password");
  assert.deepEqual(result.loaded.replaced, ["EMAIL_USER", "EMAIL_PASSWORD"], "names only, and only what differed");
  assert.deepEqual(result.loaded.shadowed, ["APP_SETTING"], "other settings keep the environment's value");
  assert.equal(result.setting, "from-panel");
  assert.doesNotMatch(
    JSON.stringify(result.loaded),
    /old-password|new-password|noreply@x\.test|support@x\.test/,
    "no value, old or new, is ever reported",
  );
});

test("under test the environment wins for mail settings too, so a developer's .env cannot change a test", (t) => {
  const dir = scratchDirectory(t, "EMAIL_USER=from-developer-env@x.test\n");
  const script = loadScript(
    "const loaded = loadEnv();" +
      "console.log(JSON.stringify({ loaded, user: process.env.EMAIL_USER }));",
  );

  const result = inFreshProcess(script, {
    cwd: dir,
    env: minimalEnv({ NODE_ENV: "test", EMAIL_USER: "test-default@x.test" }),
  });

  assert.equal(result.user, "test-default@x.test");
  assert.deepEqual(result.loaded.replaced, []);
  assert.deepEqual(result.loaded.shadowed, ["EMAIL_USER"]);
});

test("a missing .env is not an error; the process environment simply stands alone", (t) => {
  const dir = scratchDirectory(t);
  const script = loadScript("console.log(JSON.stringify(loadEnv()));");

  const result = inFreshProcess(script, { cwd: dir, env: minimalEnv({ EMAIL_USER: "x@x.test" }) });

  assert.equal(result.found, false);
  assert.deepEqual(result.shadowed, []);
  assert.deepEqual(result.replaced, []);
});

// Everything config/env insists on, and nothing about who mail is sent as.
const REQUIRED = {
  DATABASE_URL: "mysql://u:p@127.0.0.1:3306/d",
  JWT_SECRET: "x".repeat(40),
  EMAIL_HOST: "mail.example.test",
  EMAIL_PORT: "465",
  EMAIL_PASSWORD: "pw",
  DEFAULT_ADMIN_PASSWORD: "a",
  DEFAULT_SCHOOL_ADMIN_PASSWORD: "b",
  DEFAULT_LEARNER_PASSWORD: "c",
  SYSTEM_ADMIN_EMAIL: "admin@example.test",
  FRONTEND_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3000",
};

function mailConfigFor(t, env) {
  const script =
    `const env = require(${JSON.stringify(path.join(SRC, "config", "env"))});` +
    "console.log(JSON.stringify({ from: env.emailFrom, replyTo: env.emailReplyTo }));";
  return inFreshProcess(script, { cwd: scratchDirectory(t), env: minimalEnv({ ...REQUIRED, ...env }) });
}

test("the mail configuration supplies no sender or reply-to of its own", (t) => {
  // Left out of the environment, they are left out of the mail: it goes as the
  // mailbox that logs in, with no Reply-To. Nothing is filled in from the code.
  const bare = mailConfigFor(t, { EMAIL_USER: "mailbox@example.test" });
  assert.equal(bare.from, "mailbox@example.test");
  assert.equal(bare.replyTo, "");

  // Given, they are used exactly as written.
  const configured = mailConfigFor(t, {
    EMAIL_USER: "mailbox@example.test",
    EMAIL_FROM: "Some Name <sender@example.test>",
    EMAIL_REPLY_TO: "help@example.test",
  });
  assert.equal(configured.from, "Some Name <sender@example.test>");
  assert.equal(configured.replyTo, "help@example.test");
});

// Comments describe the problem; only executable lines are checked.
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

test("no email address is written into the mail code", () => {
  // Changing mail providers must only ever mean editing .env. An address in
  // these files - a default Reply-To, a fallback sender - would be a second,
  // invisible source of truth that quietly disagrees with the environment.
  const files = [
    "config/env.js",
    "config/loadEnv.js",
    "config/validateProductionEnv.js",
    "utils/email.js",
    "utils/emailConfig.js",
    "utils/mailDiagnostics.js",
  ];
  const address = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;

  const offenders = files.filter((file) =>
    address.test(withoutComments(fs.readFileSync(path.join(SRC, file), "utf8"))),
  );

  assert.deepEqual(
    offenders,
    [],
    `These contain an address that should come from .env:\n${offenders.join("\n")}`,
  );
});
