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

test("a value in the process environment beats .env, and the clash is recorded", (t) => {
  const dir = scratchDirectory(t, "EMAIL_USER=from-file@x.test\nEMAIL_HOST=host-from-file.test\n");
  const script =
    `const { loadEnv } = require(${JSON.stringify(path.join(SRC, "config", "loadEnv"))});` +
    "const first = loadEnv();" +
    'const again = loadEnv("/somewhere/else/.env");' +
    "console.log(JSON.stringify({ first, sameAnswer: first === again," +
    " user: process.env.EMAIL_USER, host: process.env.EMAIL_HOST }));";

  const result = inFreshProcess(script, {
    cwd: dir,
    env: minimalEnv({ EMAIL_USER: "from-panel@x.test" }),
  });

  assert.deepEqual(result.first.shadowed, ["EMAIL_USER"]);
  assert.equal(result.first.found, true);
  // dotenv never overrides, so the panel value is what the application would use.
  assert.equal(result.user, "from-panel@x.test");
  // What the process does not define still comes from .env.
  assert.equal(result.host, "host-from-file.test");
  // The first read is the one that saw the disagreement, so it is the one kept.
  assert.equal(result.sameAnswer, true);
});

test("a missing .env is not an error; the process environment simply stands alone", (t) => {
  const dir = scratchDirectory(t);
  const script =
    `const { loadEnv } = require(${JSON.stringify(path.join(SRC, "config", "loadEnv"))});` +
    "console.log(JSON.stringify(loadEnv()));";

  const result = inFreshProcess(script, { cwd: dir, env: minimalEnv({ EMAIL_USER: "x@x.test" }) });

  assert.equal(result.found, false);
  assert.deepEqual(result.shadowed, []);
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
