import fs from "fs";
import path from "path";

test("teacher course cards provide a learner preview action", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../layouts/teacher/index.js"),
    "utf8"
  );

  expect(source).toContain("/school-admin/courses/${course.id}/preview");
  expect(source).toContain("View as Learner");
});

test("module PDF download is shown only in staff preview mode", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../layouts/learner/course-overview/index.js"),
    "utf8"
  );

  expect(source).toContain("{previewMode && (");
  expect(source).toContain("Download PDF");
  expect(source).toContain("/pdf");
});
