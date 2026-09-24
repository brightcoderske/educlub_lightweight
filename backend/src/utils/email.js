const nodemailer = require("nodemailer");
const env = require("../config/env");
const { buildMailDefaults, buildTransportOptions } = require("./emailConfig");
const { escapeHtml } = require("./html");

const transporter = nodemailer.createTransport(buildTransportOptions(env));
const mailDefaults = buildMailDefaults(env);

let lastFailure = null;

/**
 * The one place mail is handed to the transport.
 *
 * Every caller used to swallow its own failure and return false, so a refused
 * message looked exactly like a delivered one from upstream. Delivery still
 * does not throw here - a welcome email must not fail account creation - but
 * the failure is logged with its SMTP code and returned, and the callers that
 * cannot work without delivery (MFA, password reset) check the result.
 */
async function deliver(mailOptions, description) {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(description + " sent to " + mailOptions.to + " (" + (info.messageId || "no id") + ")");
    return true;
  } catch (error) {
    lastFailure = {
      at: new Date().toISOString(),
      description,
      to: mailOptions.to,
      code: error.code || error.responseCode || "unknown",
      message: error.message,
    };
    console.error(
      description + " to " + mailOptions.to + " FAILED [" + lastFailure.code + "]: " + error.message,
    );
    return false;
  }
}

/**
 * Connects and logs in without sending anything. Never throws - the answer is in
 * the result - so startup and the mail scripts can report it without a
 * try/catch each. Uses the same transport as real mail, so it tests the
 * settings the application is actually running with.
 */
async function verifyMailLogin() {
  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: error.code || error.responseCode || "unknown",
      message: error.message,
    };
  }
}

const getLastEmailFailure = () => lastFailure;
const getMailDefaults = () => mailDefaults;

// Every value that reaches a template from outside goes through escapeHtml.
// Several are typed by people who are not staff - a self-registering learner or
// parent chooses the names that land in the notice sent to every system admin -
// and an unescaped value is HTML in a message that arrives from eduClub's own
// address: a ready-made phishing link. Only the template's own markup is markup.
function emailShell(title, body) {
  return `
    <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#344767;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(20,30,55,.12);">
        <div style="background:linear-gradient(135deg,#1A73E8,#49a3f1);padding:28px 32px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">eduClub LMS</div>
          <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;">${title}</h1>
        </div>
        <div style="padding:30px 32px;font-size:15px;line-height:1.65;">
          ${body}
        </div>
        <div style="padding:18px 32px;background:#f8fafc;font-size:12px;color:#7b809a;">
          This is an automated eduClub LMS message. Keep your login details private.
        </div>
      </div>
    </div>
  `;
}

async function sendMFACode(email, code, fullName) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "eduClub - Your MFA Verification Code",
    html: emailShell(
      "Your verification code",
      `<p>Dear ${escapeHtml(fullName)},</p>
       <p>Use this code to complete your sign in:</p>
       <div style="background:#eef5ff;border-radius:12px;padding:20px;text-align:center;margin:22px 0;">
         <span style="font-size:34px;font-weight:700;color:#1A73E8;letter-spacing:6px;">${escapeHtml(code)}</span>
       </div>
       <p>This code expires in 5 minutes.</p>`,
    ),
  };

  return deliver(mailOptions, "MFA code");
}

async function sendWelcomeEmail(email, fullName, username, password) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "Welcome to eduClub - Your Account Details",
    html: emailShell(
      "Welcome to eduClub",
      `<p>Dear ${escapeHtml(fullName)},</p>
       <p>Your account is ready. Use the details below for your first login.</p>
       <div style="background:#f8fafc;border:1px solid #e9ecef;border-radius:12px;padding:18px;margin:20px 0;">
         <p style="margin:0 0 8px;"><strong>Username:</strong> ${escapeHtml(username)}</p>
         <p style="margin:0;"><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
       </div>
       <p>You will be asked to create a stronger password on first sign in.</p>
       <p><a href="${escapeHtml(env.frontendUrl)}" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Open eduClub LMS</a></p>`,
    ),
  };

  return deliver(mailOptions, "Welcome email");
}

async function sendPasswordResetLinkEmail(
  email,
  fullName,
  resetUrl,
  expiresMinutes = 30,
) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "eduClub - Reset your password",
    html: emailShell(
      "Reset your password",
      `<p>Dear ${escapeHtml(fullName)},</p>
       <p>Use the secure link below to create a new eduClub password.</p>
       <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Set new password</a></p>
       <p>This link expires in ${escapeHtml(expiresMinutes)} minutes and can only be used once.</p>
       <p>If you did not request this reset, ignore this email or contact your eduClub administrator.</p>`,
    ),
  };

  return deliver(mailOptions, "Password reset link");
}

async function sendLearnerRegistrationWelcomeEmail({
  email,
  learnerName,
  parentName,
}) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "Welcome to eduClub - Your learner account is ready",
    html: emailShell(
      "Welcome to eduClub",
      `<p>Dear ${escapeHtml(learnerName)},</p>
       <p>Your eduClub learner account has been created with parental consent from ${escapeHtml(parentName)}.</p>
       <p>You can now sign in, explore open competitions, and join available challenges. Competition access does not require course allocation; learners enrol from the Competitions tab after payment where required.</p>
       <p>Open courses and school learning activities will appear in your dashboard when available.</p>
       <p><a href="${escapeHtml(env.frontendUrl)}/authentication/sign-in" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Open eduClub</a></p>
       <p>Keep your password private and contact your school administrator if you need help.</p>`,
    ),
  };

  return deliver(mailOptions, "Learner welcome email");
}

async function sendLearnerRegistrationAdminEmail({
  to,
  learnerName,
  learnerEmail,
  schoolName,
  grade,
  parentName,
  parentPhone,
}) {
  const mailOptions = {
    ...mailDefaults,
    to,
    subject: "eduClub - New learner self-registration",
    html: emailShell(
      "New learner registration",
      `<p>A learner has self-registered on eduClub.</p>
       <div style="background:#f8fafc;border:1px solid #e9ecef;border-radius:12px;padding:18px;margin:20px 0;">
         <p style="margin:0 0 8px;"><strong>Learner:</strong> ${escapeHtml(learnerName)}</p>
         <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(learnerEmail)}</p>
         <p style="margin:0 0 8px;"><strong>School:</strong> ${escapeHtml(schoolName)}</p>
         <p style="margin:0 0 8px;"><strong>Grade:</strong> ${escapeHtml(grade)}</p>
         <p style="margin:0 0 8px;"><strong>Parent/guardian:</strong> ${escapeHtml(parentName)}</p>
         <p style="margin:0;"><strong>Parent phone:</strong> ${escapeHtml(parentPhone)}</p>
       </div>
       <p>Please review the learner record if your operating process requires approval or follow-up.</p>`,
    ),
  };

  return deliver(mailOptions, "Learner registration notice");
}

module.exports = {
  deliver,
  verifyMailLogin,
  getLastEmailFailure,
  getMailDefaults,
  sendMFACode,
  sendWelcomeEmail,
  sendPasswordResetLinkEmail,
  sendLearnerRegistrationWelcomeEmail,
  sendLearnerRegistrationAdminEmail,
};
