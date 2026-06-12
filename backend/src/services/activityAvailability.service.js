function isDone(status) {
  return ["completed", "graded"].includes(status);
}

function resolveModuleAvailability({
  opens_at: opensAt = null,
  unlock_at: legacyUnlockAt = null,
  now = new Date(),
  has_override: hasOverride = false,
  staff_view: staffView = false,
} = {}) {
  if (staffView) return { is_open: true, reason: "staff" };
  if (hasOverride) return { is_open: true, reason: "override" };

  const boundary = opensAt || legacyUnlockAt;
  if (!boundary) return { is_open: true, reason: "unscheduled" };

  const opens = new Date(boundary);
  const current = new Date(now);
  if (Number.isNaN(opens.getTime())) return { is_open: true, reason: "unscheduled" };

  return current >= opens
    ? { is_open: true, reason: "scheduled_open" }
    : { is_open: false, reason: "scheduled", opens_at: opens.toISOString() };
}

function annotateActivityAvailability(activities = [], moduleOpen = true) {
  let previousRequired = null;

  return activities.map((activity) => {
    const mode = activity.availability_mode || "required";
    const optional = mode === "try_more";
    const prerequisite = optional ? null : previousRequired;
    const prerequisiteComplete = !prerequisite || isDone(prerequisite.status);
    const isUnlocked = moduleOpen && (optional || prerequisiteComplete);

    if (!optional) previousRequired = activity;

    return {
      ...activity,
      availability_mode: mode,
      is_unlocked: isUnlocked,
      lock_reason: isUnlocked
        ? null
        : moduleOpen
          ? "Complete the previous required activity first."
          : "This module is not open yet.",
      prerequisite_activity_id:
        !isUnlocked && prerequisite ? prerequisite.id : null,
    };
  });
}

module.exports = {
  isDone,
  resolveModuleAvailability,
  annotateActivityAvailability,
};
