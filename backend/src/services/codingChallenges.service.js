const MODES = new Set(["build", "complete", "debug"]);
const CHECK_TYPES = new Set([
  "html_contains",
  "css_contains",
  "js_contains",
  "source_contains",
  "html_tag_exists",
]);

function normalizeBooleanAnswer(value) {
  if (value === true || String(value).trim().toLowerCase() === "true") return true;
  if (value === false || String(value).trim().toLowerCase() === "false") return false;
  return null;
}

function validateCodingChallenge(activity = {}) {
  if (activity.activity_type && activity.activity_type !== "coding") return;
  const content = activity.content || {};
  const mode = content.challenge_mode || "build";
  if (!MODES.has(mode)) throw new Error("Choose Build, Complete, or Debug challenge mode.");

  const checks = Array.isArray(content.validation_checks) ? content.validation_checks : [];
  const allocated = checks.reduce((total, check) => {
    if (!CHECK_TYPES.has(check.type)) throw new Error("Unsupported automatic coding check.");
    const points = Number(check.points || 0);
    if (!Number.isFinite(points) || points < 0) throw new Error("Coding check marks are invalid.");
    return total + points;
  }, 0);
  if (allocated > Number(activity.points || 0)) {
    throw new Error("Coding check marks exceed the activity total.");
  }
}

function evaluateSourceChecks(source = {}, checks = []) {
  const parts = {
    html: String(source.html || ""),
    css: String(source.css || ""),
    js: String(source.js || ""),
  };
  parts.source = `${parts.html}\n${parts.css}\n${parts.js}`;

  const results = checks.map((check) => {
    if (check.type === "html_tag_exists") {
      const tag = String(check.value || "").replace(/[^a-z0-9-]/gi, "");
      const passed = Boolean(tag) && new RegExp(`<${tag}(\\s|>)`, "i").test(parts.html);
      return {
        type: check.type,
        passed,
        points: passed ? Number(check.points || 0) : 0,
        max_points: Number(check.points || 0),
      };
    }
    const target = check.type.replace("_contains", "");
    const haystack = parts[target] || "";
    const passed = haystack.toLowerCase().includes(String(check.value || "").toLowerCase());
    return {
      type: check.type,
      passed,
      points: passed ? Number(check.points || 0) : 0,
      max_points: Number(check.points || 0),
    };
  });
  return {
    earned_points: results.reduce((sum, result) => sum + result.points, 0),
    total_points: results.reduce((sum, result) => sum + result.max_points, 0),
    results,
  };
}

module.exports = {
  normalizeBooleanAnswer,
  validateCodingChallenge,
  evaluateSourceChecks,
};
