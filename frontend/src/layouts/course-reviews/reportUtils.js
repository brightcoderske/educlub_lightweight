export function getRatingPresentation(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) {
    return { label: "No reviews", color: "default" };
  }
  if (rating >= 4) return { label: "Strong", color: "success" };
  if (rating >= 3) return { label: "Watch", color: "warning" };
  return { label: "Needs attention", color: "error" };
}

export function buildReportQuery(filters = {}) {
  const params = new URLSearchParams();
  ["page", "pageSize", "search", "schoolId", "moduleId", "rating", "from", "to"].forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  return params.toString();
}

export function canRevealIdentity(role) {
  return role === "system_admin";
}

export function getRatingDistribution(summary = {}) {
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: Number(summary[`rating_${rating}`] || 0),
  }));
}

export function getRatingPercent(count, total) {
  const safeCount = Number(count || 0);
  const safeTotal = Number(total || 0);
  if (safeCount <= 0 || safeTotal <= 0) return 0;
  return Math.min(100, (safeCount / safeTotal) * 100);
}

export function reportMatchesMode(report, detailMode) {
  if (!report) return false;
  return detailMode ? report.mode === "course" : report.mode === "template";
}

export function formatRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "-";
}
