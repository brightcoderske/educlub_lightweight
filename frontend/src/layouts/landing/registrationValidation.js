export function passwordIssues(password = "") {
  const issues = [];

  if (password.length < 8) issues.push("8+ characters");
  if (!/[a-z]/.test(password)) issues.push("lowercase");
  if (!/[A-Z]/.test(password)) issues.push("uppercase");
  if (!/[0-9]/.test(password)) issues.push("number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("symbol");
  if (/\s/.test(password)) issues.push("no spaces");

  return issues;
}

const REQUIRED_FIELDS = [
  ["first_name", "learner first name"],
  ["second_name", "learner second name"],
  ["grade", "grade"],
  ["term_id", "academic term"],
  ["email", "learner email"],
  ["parent_full_name", "parent or guardian name"],
  ["parent_phone", "parent or guardian phone"],
  ["password", "password"],
  ["confirm_password", "password confirmation"],
];

export function registrationIssues(form = {}) {
  const issues = REQUIRED_FIELDS.filter(([field]) => !String(form[field] || "").trim()).map(
    ([, label]) => label
  );

  if (form.registration_type !== "independent" && !String(form.school_id || "").trim()) {
    issues.push("school");
  }

  if (form.password && passwordIssues(form.password).length) {
    issues.push(`password needs ${passwordIssues(form.password).join(", ")}`);
  }
  if (form.password && form.confirm_password && form.password !== form.confirm_password) {
    issues.push("passwords must match");
  }
  if (!form.parent_consent) issues.push("parent or guardian consent");

  return issues;
}
