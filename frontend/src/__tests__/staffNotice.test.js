import { staffCreatedNotice } from "../lib/staffNotice";

// The welcome email is the only place a new staff member learns their
// first-login details. These pages used to say "emailed" whatever had happened.
test("says the login details were emailed only when they were", () => {
  expect(staffCreatedNotice("school_admin", { welcome_email_sent: true })).toEqual({
    ok: true,
    text: "School Admin created. Login details have been emailed.",
  });
  expect(staffCreatedNotice("teacher", { welcome_email_sent: true })).toEqual({
    ok: true,
    text: "Teacher created. Login details have been emailed.",
  });
});

test("says plainly when the login email could not be sent, and what to do instead", () => {
  const notice = staffCreatedNotice("teacher", { welcome_email_sent: false });

  expect(notice.ok).toBe(false);
  expect(notice.text).toMatch(/^Teacher created, but the login email could not be sent/);
  expect(notice.text).toMatch(/username and the default password/);
  expect(notice.text).toMatch(/Reset password/);
});

test("a backend that does not report it yet is treated as before", () => {
  // The frontend can update before the backend does, so a missing field must not
  // turn every creation into a warning.
  expect(staffCreatedNotice("teacher", {}).ok).toBe(true);
  expect(staffCreatedNotice("teacher", undefined).ok).toBe(true);
});
