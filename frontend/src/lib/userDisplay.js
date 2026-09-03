import API_BASE_URL from "lib/apiBase";

export function getUserPhotoUrl(user) {
  const photo = user?.profilePhotoUrl || user?.profile_photo_url;
  return typeof photo === "string" && photo.startsWith("/uploads/profile-photos/")
    ? `${API_BASE_URL.replace(/\/api$/, "")}${photo}`
    : undefined;
}

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
