import {
  selectActivityContent,
  starterCode,
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
