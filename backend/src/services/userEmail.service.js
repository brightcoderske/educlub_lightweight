const { query } = require("../config/db");
const { withTransaction } = require("../database/transaction");
const { isUniqueViolation } = require("../utils/dbErrors");

/**
 * One email address, kept in two places.
 *
 * A learner has a row in `users` (what they sign in with, and where password
 * resets and MFA codes are sent) and a row in `learners` (what school staff see
 * and what reports use). Changing one and not the other is why a learner could
 * be given a real address and still never receive anything: the update only
 * ever touched `learners.email`, while every email the system sends reads
 * `users.email` - which was still the generated `@learners.educlub.local`
 * placeholder that no mail server can deliver to.
 */

const PLACEHOLDER_DOMAIN = "learners.educlub.local";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

const isPlaceholderEmail = (email) =>
  normalizeEmail(email).endsWith(`@${PLACEHOLDER_DOMAIN}`);

/**
 * The one rule for whether mail to an address can arrive: what is wrong with
 * it, as a message a child can act on, or null when nothing is. An address is
 * held to the same rule when it is entered and when something is about to be
 * sent to it.
 */
function problemWith(email) {
  if (!email) return "Enter an email address.";
  if (email.length > 255) return "That email address is too long.";
  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a complete email address, like yourname@gmail.com.";
  }
  // The generated placeholder is not a real mailbox; accepting it back would
  // quietly undo a working address.
  if (email.endsWith(".local")) {
    return "Use a real email address you can open, not an eduClub placeholder.";
  }
  return null;
}

/**
 * Returns the cleaned address, or throws an Error carrying statusCode 400 with
 * a message a child can act on.
 */
function assertUsableEmail(value) {
  const email = normalizeEmail(value);
  const problem = problemWith(email);

  if (problem) {
    const error = new Error(problem);
    error.statusCode = 400;
    throw error;
  }
  return email;
}

const isDeliverableEmail = (value) => problemWith(normalizeEmail(value)) === null;

async function assertEmailIsFree(email, userId) {
  const clash = await query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1",
    [email, userId],
  );
  if (clash.rows.length) {
    const error = new Error("That email address is already used by another account.");
    error.statusCode = 409;
    throw error;
  }
}

/**
 * Writes the address to `users` and to `learners` as one unit, so the two can
 * never drift apart. Returns the stored address.
 */
async function setLearnerEmail({ learnerId, userId, email }) {
  const next = assertUsableEmail(email);
  if (userId) await assertEmailIsFree(next, userId);

  try {
    await withTransaction(async (client) => {
      if (userId) {
        await client.query(
          "UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2",
          [next, userId],
        );
      }
      await client.query("UPDATE learners SET email = $1 WHERE id = $2", [
        next,
        learnerId,
      ]);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error("That email address is already used by another account.");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }

  return next;
}

/** Keeps `learners.email` in step when an administrator edits the user record. */
async function syncLearnerEmailFromUser(userId, email) {
  const next = normalizeEmail(email);
  if (!next) return;
  await query("UPDATE learners SET email = $1 WHERE user_id = $2", [next, userId]);
}

module.exports = {
  normalizeEmail,
  isPlaceholderEmail,
  isDeliverableEmail,
  assertUsableEmail,
  setLearnerEmail,
  syncLearnerEmailFromUser,
  PLACEHOLDER_DOMAIN,
};
