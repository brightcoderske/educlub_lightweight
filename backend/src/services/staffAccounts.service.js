function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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
    username: email,
  };
}

module.exports = {
  normalizeEmail,
  resolveStaffAccountInput,
};
