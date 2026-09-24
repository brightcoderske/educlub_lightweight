function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * A username is whatever the school wants to type at sign-in: a name like
 * floyedmuchiri, or the person's email address. Login matches either against
 * this column, so the only rules are that it is present, has no spaces, and
 * fits the column.
 */
function resolveUsername(value, fallbackEmail) {
  const username = String(value ?? "").trim();
  if (!username) return fallbackEmail;
  if (/\s/.test(username)) {
    throw new Error("A username cannot contain spaces.");
  }
  if (username.length < 3 || username.length > 255) {
    throw new Error("A username must be between 3 and 255 characters.");
  }
  return username.includes("@") ? username.toLowerCase() : username;
}

function resolveStaffAccountInput(actor = {}, input = {}) {
  const role = input.role || "teacher";
  if (!["system_admin", "school_admin"].includes(actor.role)) {
    throw new Error("Only administrators can manage staff accounts.");
  }
  if (actor.role === "school_admin" && role !== "teacher") {
    throw new Error("School administrators may create teachers only.");
  }

  const schoolId = Number(
    actor.role === "school_admin" ? actor.schoolId : input.school_id,
  );
  const email = normalizeEmail(input.email);
  const fullName = String(input.full_name || "").trim();

  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new Error("A valid school is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required.");
  }
  if (!fullName) {
    throw new Error("Full name is required.");
  }

  return {
    role,
    schoolId,
    fullName,
    email,
    username: resolveUsername(input.username, email),
  };
}

module.exports = {
  normalizeEmail,
  resolveUsername,
  resolveStaffAccountInput,
};
