const nodemailer = require("nodemailer");
const env = require("../config/env");
const {
  buildMailDefaults,
  buildTransportOptions,
} = require("./emailConfig");

const transporter = nodemailer.createTransport(buildTransportOptions(env));
const mailDefaults = buildMailDefaults(env);

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
      `<p>Dear ${fullName},</p>
       <p>Use this code to complete your sign in:</p>
       <div style="background:#eef5ff;border-radius:12px;padding:20px;text-align:center;margin:22px 0;">
         <span style="font-size:34px;font-weight:700;color:#1A73E8;letter-spacing:6px;">${code}</span>
       </div>
       <p>This code expires in 5 minutes.</p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`MFA code sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send MFA code:", error);
    return false;
  }
}

async function sendWelcomeEmail(email, fullName, username, password) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "Welcome to eduClub - Your Account Details",
    html: emailShell(
      "Welcome to eduClub",
      `<p>Dear ${fullName},</p>
       <p>Your account is ready. Use the details below for your first login.</p>
       <div style="background:#f8fafc;border:1px solid #e9ecef;border-radius:12px;padding:18px;margin:20px 0;">
         <p style="margin:0 0 8px;"><strong>Username:</strong> ${username}</p>
         <p style="margin:0;"><strong>Temporary password:</strong> ${password}</p>
       </div>
       <p>You will be asked to create a stronger password on first sign in.</p>
       <p><a href="${env.frontendUrl}" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Open eduClub LMS</a></p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return false;
  }
}

async function sendPasswordResetEmail(email, fullName, username, password) {
  const mailOptions = {
    ...mailDefaults,
    to: email,
    subject: "eduClub - Password Reset",
    html: emailShell(
      "Password reset",
      `<p>Dear ${fullName},</p>
       <p>Your password has been reset by an administrator.</p>
       <div style="background:#fff8e6;border:1px solid #ffe1a6;border-radius:12px;padding:18px;margin:20px 0;">
         <p style="margin:0 0 8px;"><strong>Username:</strong> ${username}</p>
         <p style="margin:0;"><strong>Temporary password:</strong> ${password}</p>
       </div>
       <p>You will be asked to create a new password after sign in.</p>
       <p><a href="${env.frontendUrl}" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Sign in to eduClub LMS</a></p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return false;
  }
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
      `<p>Dear ${fullName},</p>
       <p>Use the secure link below to create a new eduClub password.</p>
       <p><a href="${resetUrl}" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Set new password</a></p>
       <p>This link expires in ${expiresMinutes} minutes and can only be used once.</p>
       <p>If you did not request this reset, ignore this email or contact your eduClub administrator.</p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset link sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send password reset link:", error);
    return false;
  }
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
      `<p>Dear ${learnerName},</p>
       <p>Your eduClub learner account has been created with parental consent from ${parentName}.</p>
       <p>You can now sign in, explore open competitions, and join available challenges. Competition access does not require course allocation; learners enrol from the Competitions tab after payment where required.</p>
       <p>Open courses and school learning activities will appear in your dashboard when available.</p>
       <p><a href="${env.frontendUrl}/authentication/sign-in" style="display:inline-block;background:#1A73E8;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;">Open eduClub</a></p>
       <p>Keep your password private and contact your school administrator if you need help.</p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Learner registration welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send learner registration welcome email:", error);
    return false;
  }
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
         <p style="margin:0 0 8px;"><strong>Learner:</strong> ${learnerName}</p>
         <p style="margin:0 0 8px;"><strong>Email:</strong> ${learnerEmail}</p>
         <p style="margin:0 0 8px;"><strong>School:</strong> ${schoolName}</p>
         <p style="margin:0 0 8px;"><strong>Grade:</strong> ${grade}</p>
         <p style="margin:0 0 8px;"><strong>Parent/guardian:</strong> ${parentName}</p>
         <p style="margin:0;"><strong>Parent phone:</strong> ${parentPhone}</p>
       </div>
       <p>Please review the learner record if your operating process requires approval or follow-up.</p>`,
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Learner registration admin email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send learner registration admin email:", error);
    return false;
  }
}

module.exports = {
  sendMFACode,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetLinkEmail,
  sendLearnerRegistrationWelcomeEmail,
  sendLearnerRegistrationAdminEmail,
};
