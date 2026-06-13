import {
  selectActivityContent,
  starterCode,
  starterParts,
  webPreview,
} from "../layouts/learner/module-learn/activityContent";

test("keeps teacher notes out and returns learner support", () => {
  const selected = selectActivityContent({
    teacher_notes: "Hidden",
    friendly_hints: ["Preview after each change."],
    module_badge: { name: "HTML Builder" },
  });
  expect(selected.hints).toEqual(["Preview after each change."]);
  expect(selected.badgeName).toBe("HTML Builder");
  expect(selected.teacher_notes).toBeUndefined();
});

test("returns Scratch submission guidance", () => {
  const selected = selectActivityContent({
    submission_accept: [
      ".sb3",
      "application/x.scratch.sb3",
      "application/zip",
      "application/octet-stream",
    ],
    submission_help: [
      "Save the project to your computer.",
      "Upload your downloaded Scratch .sb3 project.",
    ],
  });

  expect(selected.submission.accept).toContain(".sb3");
  expect(selected.submission.accept).toContain("application/zip");
  expect(selected.submission.help).toContain("Save the project");
  expect(selected.submission.help).toContain("Scratch");
});

test("returns safe default submission metadata", () => {
  const selected = selectActivityContent();

  expect(selected.submission.accept).toContain("image/png");
  expect(selected.submission.accept).not.toContain("application/zip");
  expect(selected.submission.help).toBe("");
});

test("combines separate starter HTML and CSS", () => {
  expect(starterCode({
    starter_html: "<h1>Hello</h1>",
    starter_css: "h1 { color: blue; }",
  })).toContain("<style>");
});

test("HTML CSS preview removes scripts unless JavaScript is enabled", () => {
  const html = "<h1>Hello</h1><script>window.alert('no')</script>";
  expect(webPreview(html, "h1 { color: blue; }", false)).not.toContain("<script>");
  expect(webPreview(html, "", true)).toContain("<script>");
});

test("legacy starter code populates the HTML editor", () => {
  expect(starterParts({ starter_code: "<h1>Legacy</h1>" })).toEqual({
    html: "<h1>Legacy</h1>",
    css: "",
  });
});
