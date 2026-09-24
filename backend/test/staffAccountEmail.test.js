const test = require("node:test");
const assert = require("node:assert/strict");

// The welcome email is the only place a new staff member learns their
// first-login details. The account exists whether or not it is sent, so a send
// that fails must not fail the request - but the administrator must be told,
// because the page used to say "Login details have been emailed" regardless.
//
// The database and the mailer are replaced before the controller is loaded,
// because it takes its dependencies at load time.
const config = require("../src/config");
const emailModule = require("../src/utils/email");

const welcomes = [];
let welcomeResult = true;

config.query = async () => ({
  rows: [
    {
      id: 11,
      email: "tom@example.test",
      full_name: "Tom Otieno",
      role: "teacher",
      school_id: 3,
      username: "tom@example.test",
      force_password_reset: true,
      is_active: true,
    },
  ],
  rowCount: 1,
});
emailModule.sendWelcomeEmail = async (...args) => {
  welcomes.push(args);
  return welcomeResult;
};

const authService = require("../src/services/auth.service");
const usersController = require("../src/controllers/users.controller");
const { fakeResponse } = require("./fakeResponse");

const schoolAdminRequest = () => ({
  user: { role: "school_admin", schoolId: 3, userId: 2 },
  body: { role: "teacher", full_name: "Tom Otieno", email: "Tom@Example.test" },
});

test("a new staff member's welcome email is reported as sent when it was", async (t) => {
  t.mock.method(console, "log", () => {});
  welcomes.length = 0;
  welcomeResult = true;

  const res = fakeResponse();
  await usersController.createStaffAccount(schoolAdminRequest(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.welcome_email_sent, true);
  assert.equal(welcomes.length, 1);
  assert.equal(welcomes[0][0], "tom@example.test", "the email goes to the new person's address");
});

test("the account is still created when the welcome email cannot be sent, and the page is told", async (t) => {
  t.mock.method(console, "log", () => {});
  welcomes.length = 0;
  welcomeResult = false;

  const res = fakeResponse();
  await usersController.createStaffAccount(schoolAdminRequest(), res);

  assert.equal(res.statusCode, 201, "the account exists, so this is not a failed request");
  assert.equal(res.body.welcome_email_sent, false);
  assert.equal(res.body.id, 11);
});

test("an administrator whose reset link could not be emailed is told why, with the right status", async (t) => {
  t.mock.method(console, "error", () => {});
  const original = authService.sendPasswordResetLinkForUser;
  authService.sendPasswordResetLinkForUser = async () => {
    throw Object.assign(
      new Error("The reset link could not be emailed. Email delivery is not working right now, so nothing was sent."),
      { statusCode: 503 },
    );
  };

  try {
    const res = fakeResponse();
    await usersController.resetUserPasswordByEmail(
      { params: { id: 11 }, user: { role: "system_admin", userId: 1 }, ip: "203.0.113.5", get: () => "ua" },
      res,
    );

    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /could not be emailed/);
  } finally {
    authService.sendPasswordResetLinkForUser = original;
  }
});

test("any other failure while resetting is still a generic 500", async (t) => {
  t.mock.method(console, "error", () => {});
  const original = authService.sendPasswordResetLinkForUser;
  authService.sendPasswordResetLinkForUser = async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3306 with details that should not leak");
  };

  try {
    const res = fakeResponse();
    await usersController.resetUserPasswordByEmail(
      { params: { id: 11 }, user: { role: "system_admin", userId: 1 }, ip: "203.0.113.5", get: () => "ua" },
      res,
    );

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, "Failed to reset password by email");
  } finally {
    authService.sendPasswordResetLinkForUser = original;
  }
});
