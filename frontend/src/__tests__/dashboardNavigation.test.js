import { buildDashboardBreadcrumbs } from "../examples/Breadcrumbs/navigation";

test("dashboard breadcrumbs stay inside the active role area", () => {
  expect(
    buildDashboardBreadcrumbs(["school-admin", "courses", "42", "builder"])
  ).toEqual({
    homePath: "/school-admin",
    items: [
      { label: "school admin", path: "/school-admin", clickable: true },
      { label: "courses", path: "/school-admin/courses", clickable: true },
      { label: "42", path: null, clickable: false },
    ],
  });
});

test("learner course identifiers are labels rather than broken links", () => {
  const result = buildDashboardBreadcrumbs(["learner", "courses", "17"]);
  expect(result.homePath).toBe("/learner");
  expect(result.items[1]).toEqual({
    label: "courses",
    path: "/learner/courses",
    clickable: true,
  });
});
