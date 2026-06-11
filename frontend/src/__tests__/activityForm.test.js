import {
  activityToStructuredForm,
  structuredFormContent,
} from "../layouts/course-builder/activityForm";

test("loads editable course-template fields", () => {
  const form = activityToStructuredForm({
    content: {
      purpose: "quiz",
      friendly_hints: ["Try the reading again."],
      teacher_notes: "Model the first question.",
      module_badge: { name: "Web Explorer" },
      media: { image_alt: "Browser and server diagram.", transcript: "A browser requests files." },
    },
  });
  expect(form.friendly_hints_text).toBe("Try the reading again.");
  expect(form.teacher_notes).toBe("Model the first question.");
  expect(form.badge_name).toBe("Web Explorer");
  expect(form.image_alt).toBe("Browser and server diagram.");
});

test("saves separate HTML CSS media and friendly hints", () => {
  const content = structuredFormContent({
    starter_html: "<h1>Hello</h1>", starter_css: "h1 { color: blue; }",
    friendly_hints_text: "Check the heading.\nPreview the page.",
    image_alt: "A page heading.", transcript: "Add an h1 element.",
  }, []);
  expect(content.starter_html).toBe("<h1>Hello</h1>");
  expect(content.starter_css).toBe("h1 { color: blue; }");
  expect(content.friendly_hints).toEqual(["Check the heading.", "Preview the page."]);
  expect(content.media.image_alt).toBe("A page heading.");
});
