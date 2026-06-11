import { selectActivityContent, starterCode } from "../layouts/learner/module-learn/activityContent";

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
