/**
 * What to tell an administrator after creating a staff account.
 *
 * The account exists either way. The welcome email is the only place the new
 * person learns their first-login details, so when it could not be sent the
 * administrator has to hear that - these pages used to say "emailed" whatever
 * had happened, and the teachers page said nothing at all.
 *
 * A backend that does not report `welcome_email_sent` (an older release still
 * running while the frontend has already updated) is treated as before.
 */
export function staffCreatedNotice(role, created) {
  const label = role === "teacher" ? "Teacher" : "School Admin";

  if (created && created.welcome_email_sent === false) {
    return {
      ok: false,
      text: `${label} created, but the login email could not be sent because email delivery is not working right now. Give them their username and the default password yourself, or use Reset password once email is fixed.`,
    };
  }

  return { ok: true, text: `${label} created. Login details have been emailed.` };
}
