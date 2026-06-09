export function getUserDisplayName(user) {
  return user?.fullName || user?.full_name || user?.username || user?.email || "eduClub User";
}

export function getUserInitials(user) {
  const displayName = getUserDisplayName(user);
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toUpperCase() || "EC";
}

export function getRoleLabel(role) {
  const labels = {
    system_admin: "System Admin",
    school_admin: "School Admin",
    learner: "Learner",
  };

  return labels[role] || "eduClub";
}
