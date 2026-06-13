import { courseOverviewPath, moduleLearningPath } from "../layouts/learner/previewNavigation";

test("staff preview routes stay separate from learner routes", () => {
  expect(courseOverviewPath(8, false)).toBe("/learner/courses/8");
  expect(courseOverviewPath(8, true)).toBe("/school-admin/courses/8/preview");
  expect(moduleLearningPath(8, 3, 12, true)).toBe(
    "/school-admin/courses/8/preview/modules/3/learn?activity=12"
  );
});
