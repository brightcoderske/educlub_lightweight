const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// MFA is on by default for system admins and school admins: after the password
// they must enter a six-digit code emailed to them, unless the browser holds a
// trusted-device token. These tests run the real sign-in and verification logic
// over a small in-memory stand-in for the database and a stand-in mailer, so
// what is asserted is behaviour: who is asked for a code, what is stored, what
// happens when the email cannot be sent.
//
// Both stand-ins are installed before the service is loaded, because the
// service takes its dependencies at load time.
const config = require("../src/config");
const emailModule = require("../src/utils/email");
const env = require("../src/config/env");

const PASSWORD = "Correct-Pass-1";
const IP = "203.0.113.5";

const state = { user: null, policy: null, devices: [] };
const emails = [];
let mailWorks = true;

function reset({ user = {}, policy = { system_admin: true, school_admin: true } } = {}) {
  state.user = {
    id: 7,
    email: "admin@example.test",
    username: "admin",
    full_name: "Admin User",
    role: "system_admin",
    school_id: null,
    password: bcrypt.hashSync(PASSWORD, 4),
    is_active: true,
    force_password_reset: false,
    mfa_code_hash: null,
    mfa_code_attempts: 0,
    mfa_code_expires_at: null,
    ...user,
  };
  state.policy = policy;
  state.devices = [];
  emails.length = 0;
  mailWorks = true;
}

const rows = (list) => ({ rows: list, rowCount: list.length });

// Answers the statements the sign-in flow issues, matched on their text. The
// "wrong code" statement is matched exactly, so a version of it that does more
// than count the attempt has no answer here and fails the test that runs it.
config.query = async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ").trim();

  if (/^SELECT \* FROM users WHERE \(LOWER\(email\)/.test(sql)) {
    const asked = String(params[0]).toLowerCase();
    const found = [state.user.email, state.user.username].some((value) => value.toLowerCase() === asked);
    return rows(found ? [state.user] : []);
  }
  if (/^SELECT \* FROM users WHERE id = \$1 AND is_active = true/.test(sql)) {
    return rows(params[0] === state.user.id ? [state.user] : []);
  }
  if (/FROM system_settings WHERE `key` = 'mfa_policy'/.test(sql)) {
    return rows(state.policy ? [{ value: state.policy }] : []);
  }
  if (/^INSERT INTO system_settings \(`key`, value, updated_by_user_id, updated_at\) VALUES \('mfa_policy'/.test(sql)) {
    state.policy = JSON.parse(params[0]);
    return rows([{ value: state.policy }]);
  }
  if (/^UPDATE users SET mfa_code = NULL, mfa_code_hash = \$1/.test(sql)) {
    Object.assign(state.user, {
      mfa_code_hash: params[0],
      mfa_code_attempts: 0,
      mfa_code_expires_at: params[1],
    });
    return rows([]);
  }
  if (/^UPDATE users SET mfa_code_hash = NULL, mfa_code_expires_at = NULL/.test(sql)) {
    Object.assign(state.user, { mfa_code_hash: null, mfa_code_expires_at: null });
    return rows([]);
  }
  if (sql === "UPDATE users SET mfa_code_attempts = mfa_code_attempts + 1 WHERE id = $1") {
    state.user.mfa_code_attempts += 1;
    return rows([]);
  }
  if (/^UPDATE users SET mfa_code = NULL, mfa_code_hash = NULL, mfa_code_attempts = 0/.test(sql)) {
    Object.assign(state.user, { mfa_code_hash: null, mfa_code_attempts: 0, mfa_code_expires_at: null });
    return rows([]);
  }
  if (/^UPDATE trusted_mfa_devices SET last_used_at = NOW\(\)/.test(sql)) {
    const [userId, tokenHash] = params;
    const device = state.devices.find(
      (item) => item.user_id === userId && item.token_hash === tokenHash && item.expires_at > new Date(),
    );
    return rows(device ? [{ id: 1 }] : []);
  }
  if (/^INSERT INTO trusted_mfa_devices/.test(sql)) {
    state.devices.push({ user_id: params[0], token_hash: params[1], expires_at: params[4] });
    return rows([]);
  }
  if (/FROM user_consents/.test(sql)) return rows([{ id: 1, policy_version: "any", consented_at: new Date() }]);
  if (/FROM schools/.test(sql)) return rows([]);

  throw new Error(`an MFA test ran a statement it has no answer for: ${sql}`);
};
emailModule.sendMFACode = async (to, code, name) => {
  emails.push({ to, code, name });
  return mailWorks;
};

const authService = require("../src/services/auth.service");

const signIn = (identifier = "admin@example.test", trustedDeviceToken = null) =>
  authService.login(identifier, PASSWORD, trustedDeviceToken);
const wrongCode = (code) => (code === "000000" ? "111111" : "000000");

test("a wrong password never reaches the code step", async () => {
  reset();

  await assert.rejects(() => authService.login("admin@example.test", "not-the-password", null), /Invalid credentials/);
  assert.equal(emails.length, 0, "no code is emailed to someone who has not proved the password");
});

test("a system admin is asked for a code, which is emailed to them and stored only as a hash", async () => {
  reset();

  const result = await signIn();

  assert.equal(result.mfaRequired, true);
  assert.equal(result.token, undefined, "no session exists until the code is entered");
  assert.equal(jwt.verify(result.tempToken, env.jwtSecret).mfaPending, true);

  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, "admin@example.test");
  assert.equal(emails[0].name, "Admin User");
  assert.match(emails[0].code, /^[1-9]\d{5}$/, "six digits, never starting with zero");

  assert.equal(state.user.mfa_code_hash, authService.hashMfaCode(emails[0].code));
  assert.notEqual(state.user.mfa_code_hash, emails[0].code, "the code itself is never stored");
  const lifetime = new Date(state.user.mfa_code_expires_at).getTime() - Date.now();
  assert.ok(lifetime > 4 * 60 * 1000 && lifetime <= 5 * 60 * 1000, "the code lives for five minutes");
});

test("signing in with the username asks for a code just the same", async () => {
  reset();

  assert.equal((await signIn("admin")).mfaRequired, true);
  assert.equal(emails.length, 1);
});

test("the right code completes the sign-in, and only once", async () => {
  reset();
  const { tempToken } = await signIn();
  const code = emails[0].code;

  const session = await authService.verify2FA(tempToken, code, false, IP, "test-agent");

  assert.ok(session.token, "a session token is issued");
  assert.equal(session.user.role, "system_admin");
  assert.equal(session.trustedDeviceToken, undefined, "the device is not remembered unless asked");
  assert.equal(state.user.mfa_code_hash, null, "the code is used up");
  await assert.rejects(
    () => authService.verify2FA(tempToken, code, false, IP, "test-agent"),
    /expired/,
    "the same code cannot be used twice",
  );
});

test("a wrong code is refused, and the right one still works afterwards", async () => {
  reset();
  const { tempToken } = await signIn();
  const code = emails[0].code;

  await assert.rejects(() => authService.verify2FA(tempToken, wrongCode(code), false, IP, "ua"), /Invalid MFA code/);
  assert.equal(state.user.mfa_code_attempts, 1);

  assert.ok((await authService.verify2FA(tempToken, code, false, IP, "ua")).token);
});

test("a person gets five tries at a code: the fifth wrong one is still just wrong", async () => {
  reset();
  const { tempToken } = await signIn();
  const code = emails[0].code;

  // MySQL and MariaDB run a statement's assignments left to right, so a count
  // raised and tested in one statement gave one try too few. Four wrong codes
  // must leave the right one working.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(() => authService.verify2FA(tempToken, wrongCode(code), false, IP, "ua"), /Invalid MFA code/);
  }
  assert.ok((await authService.verify2FA(tempToken, code, false, IP, "ua")).token, "the fifth try, if right, works");
});

test("after five wrong codes the code is used up, and the person is told why", async () => {
  reset();
  const { tempToken } = await signIn();
  const code = emails[0].code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(() => authService.verify2FA(tempToken, wrongCode(code), false, IP, "ua"), /Invalid MFA code/);
  }

  await assert.rejects(
    () => authService.verify2FA(tempToken, code, false, IP, "ua"),
    /Too many MFA attempts/,
    "even the right code is refused once the tries are used up",
  );
  // Signing in again issues a fresh code with a fresh count.
  await signIn();
  assert.equal(state.user.mfa_code_attempts, 0);
  assert.ok((await authService.verify2FA(tempToken, emails[1].code, false, IP, "ua")).token);
});

test("a code that has expired is refused", async () => {
  reset();
  const { tempToken } = await signIn();
  state.user.mfa_code_expires_at = new Date(Date.now() - 1000);

  await assert.rejects(() => authService.verify2FA(tempToken, emails[0].code, false, IP, "ua"), /expired/);
});

test("a token that only proves the password cannot be used to skip the code", async () => {
  reset();
  const notPending = jwt.sign({ userId: 7 }, env.jwtSecret, { expiresIn: "5m" });

  await assert.rejects(() => authService.verify2FA(notPending, "123456", false, IP, "ua"), /Invalid temporary token/);
});

test("when the code cannot be emailed the sign-in fails plainly, with no usable code left behind", async () => {
  reset();
  mailWorks = false;

  await assert.rejects(
    () => signIn(),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /could not email your verification code/i);
      return true;
    },
  );
  assert.equal(state.user.mfa_code_hash, null, "a code nobody received must not stay valid");
  assert.equal(state.user.mfa_code_expires_at, null);
});

test("a trusted device skips the code, and a device is trusted only when the person asks", async () => {
  reset();

  // Trusting the device is a choice made on the code screen.
  const first = await signIn();
  const remembered = await authService.verify2FA(first.tempToken, emails[0].code, true, IP, "ua");
  assert.match(remembered.trustedDeviceToken, /^[a-f0-9]{64}$/);
  const trustedFor = new Date(remembered.trustedDeviceExpiresAt).getTime() - Date.now();
  assert.ok(trustedFor > 11 * 60 * 60 * 1000 && trustedFor <= 12 * 60 * 60 * 1000, "trusted for twelve hours");

  // The next sign-in from that browser goes straight through, with nothing emailed.
  const before = emails.length;
  const again = await signIn("admin@example.test", remembered.trustedDeviceToken);
  assert.ok(again.token);
  assert.equal(again.mfaTrustedDevice, true);
  assert.equal(emails.length, before, "no code is sent to a trusted device");

  // Any other browser, or none, is still asked.
  assert.equal((await signIn("admin@example.test", "f".repeat(64))).mfaRequired, true);
  assert.equal((await signIn()).mfaRequired, true);
});

test("a trusted device stops being trusted once its time is up", async () => {
  reset();
  const first = await signIn();
  const remembered = await authService.verify2FA(first.tempToken, emails[0].code, true, IP, "ua");

  state.devices[0].expires_at = new Date(Date.now() - 1000);

  assert.equal((await signIn("admin@example.test", remembered.trustedDeviceToken)).mfaRequired, true);
});

test("MFA is on by default: with no policy stored, admins are asked for a code", async () => {
  reset({ policy: null });

  assert.equal((await signIn()).mfaRequired, true);

  reset({ policy: null, user: { role: "school_admin", id: 7, school_id: 3 } });
  assert.equal((await signIn()).mfaRequired, true);
});

test("switching MFA off for a role lets that role straight in, and only that role", async () => {
  reset({ policy: { system_admin: false, school_admin: true } });
  const systemAdmin = await signIn();
  assert.ok(systemAdmin.token, "the system admin policy is off, so no code is asked for");
  assert.equal(emails.length, 0);

  reset({ policy: { system_admin: false, school_admin: true }, user: { role: "school_admin", school_id: 3 } });
  assert.equal((await signIn()).mfaRequired, true, "school admins are still asked");
});

test("teachers and learners are never asked for a code, whatever the policy says", async () => {
  for (const role of ["teacher", "learner"]) {
    reset({ user: { role, school_id: 3 } });
    const result = await signIn();
    assert.ok(result.token, `${role} signs in with the password alone`);
    assert.equal(emails.length, 0);
  }
});

test("every code generated is six digits and does not start with zero", () => {
  for (let index = 0; index < 500; index += 1) {
    assert.match(authService.generateMFACode(), /^[1-9]\d{5}$/);
  }
});

// The System Admin dashboard's "Administrator MFA" card is the switch for all of
// the above: GET and PUT /api/auth/mfa-policy, restricted to system admins.
test("the System Admin's change to one role leaves the other role's setting alone", async () => {
  reset({ policy: { system_admin: false, school_admin: true } });

  // Only school admins are named. System admin MFA was switched off earlier and
  // must stay off: leaving a role out used to switch it back on.
  const saved = await authService.updateMfaPolicy({ school_admin: false }, 1);

  assert.deepEqual(saved, { system_admin: false, school_admin: false });
  assert.deepEqual(state.policy, { system_admin: false, school_admin: false });
});

test("the dashboard's request, which names both roles, sets both", async () => {
  reset({ policy: { system_admin: true, school_admin: true } });

  const saved = await authService.updateMfaPolicy({ system_admin: false, school_admin: true }, 1);

  assert.deepEqual(saved, { system_admin: false, school_admin: true });
  assert.deepEqual(await authService.getMfaPolicy(), { system_admin: false, school_admin: true });
});

test("only real on/off values change the policy, and only for the roles it covers", async () => {
  reset({ policy: { system_admin: true, school_admin: true } });

  const saved = await authService.updateMfaPolicy(
    { system_admin: "no", school_admin: false, teacher: false },
    1,
  );

  assert.deepEqual(saved, { system_admin: true, school_admin: false });
  assert.equal("teacher" in state.policy, false, "there is no MFA setting for teachers");
});

test("a change the System Admin makes applies from the next sign-in", async () => {
  reset({ policy: { system_admin: true, school_admin: true } });
  assert.equal((await signIn()).mfaRequired, true);

  await authService.updateMfaPolicy({ system_admin: false }, 7);
  const before = emails.length;

  const result = await signIn();
  assert.ok(result.token, "signs in with the password alone once the role is switched off");
  assert.equal(emails.length, before, "and no code is emailed");

  await authService.updateMfaPolicy({ system_admin: true }, 7);
  assert.equal((await signIn()).mfaRequired, true, "switching it back on asks for codes again");
});

test("with nothing stored the policy reads as on for both roles", async () => {
  reset({ policy: null });

  assert.deepEqual(await authService.getMfaPolicy(), { system_admin: true, school_admin: true });
});

test("only a system admin may read or change the policy", () => {
  const routes = fs.readFileSync(path.join(__dirname, "../src/routes/auth.routes.js"), "utf8");

  const guarded = routes.match(
    /router\.(?:get|put)\(\s*"\/mfa-policy",\s*authenticateToken,\s*requireRole\("system_admin"\)/g,
  );
  assert.equal(guarded?.length, 2, "both the read and the write are behind the system admin role");
});
