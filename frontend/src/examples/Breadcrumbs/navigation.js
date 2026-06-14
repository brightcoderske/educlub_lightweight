function labelFor(segment = "") {
  return decodeURIComponent(segment).replaceAll("-", " ");
}

function isIdentifier(segment = "") {
  return /^\d+$/.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment);
}

export function buildDashboardBreadcrumbs(route = []) {
  const segments = Array.isArray(route) ? route.filter(Boolean) : [];
  const root = segments[0] || "";

  return {
    homePath: root ? `/${root}` : "/",
    items: segments.slice(0, -1).map((segment, index) => ({
      label: labelFor(segment),
      path: isIdentifier(segment) ? null : `/${segments.slice(0, index + 1).join("/")}`,
      clickable: !isIdentifier(segment),
    })),
  };
}
