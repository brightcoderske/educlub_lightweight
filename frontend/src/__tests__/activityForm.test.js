import {
  activityToStructuredForm,
  replaceActivityInBuilderData,
  saveActivityWithFeedback,
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

test("loads legacy activity learning content into the rich editor", () => {
  const form = activityToStructuredForm({
    activity_type: "lesson",
    content: {
      description: "<h2>Variables</h2><p>A variable stores information.</p>",
    },
  });

  expect(form.description).toBe("");
  expect(form.rich_html).toBe("<h2>Variables</h2><p>A variable stores information.</p>");
});

test("keeps a short description separate when rich learning content exists", () => {
  const form = activityToStructuredForm({
    activity_type: "lesson",
    content: {
      description: "A quick introduction to variables.",
      rich_html: "<h2>Variables</h2><p>A variable stores information.</p>",
    },
  });

  expect(form.description).toBe("A quick introduction to variables.");
  expect(form.rich_html).toContain("A variable stores information.");
});

test("saves separate HTML CSS media and friendly hints", () => {
  const content = structuredFormContent(
    {
      original_content: {
        vocabulary: [{ term: "HTML", meaning: "Structure" }],
        unlimited_retries: true,
      },
      starter_html: "<h1>Hello</h1>",
      starter_css: "h1 { color: blue; }",
      friendly_hints_text: "Check the heading.\nPreview the page.",
      image_alt: "A page heading.",
      transcript: "Add an h1 element.",
    },
    []
  );
  expect(content.starter_html).toBe("<h1>Hello</h1>");
  expect(content.starter_css).toBe("h1 { color: blue; }");
  expect(content.friendly_hints).toEqual(["Check the heading.", "Preview the page."]);
  expect(content.media.image_alt).toBe("A page heading.");
  expect(content.vocabulary).toEqual([{ term: "HTML", meaning: "Structure" }]);
  expect(content.unlimited_retries).toBe(true);
});

test("keeps the activity editor open and reports a rejected save", async () => {
  const result = await saveActivityWithFeedback(
    async () => {
      throw new Error("Your session has expired. Please sign in again, then retry.");
    },
    { title: "Updated lesson" }
  );

  expect(result).toEqual({
    saved: false,
    error: "Your session has expired. Please sign in again, then retry.",
  });
});

test("confirms a successful activity save", async () => {
  const payload = { title: "Updated lesson" };
  const onSave = jest.fn().mockResolvedValue({ id: 9, ...payload });

  await expect(saveActivityWithFeedback(onSave, payload)).resolves.toEqual({
    saved: true,
    error: "",
  });
  expect(onSave).toHaveBeenCalledWith(payload);
});

test("updates the saved activity locally without reloading the whole builder", () => {
  const data = {
    template: { id: 2, version: 3 },
    modules: [
      {
        id: 4,
        activities: [
          { id: 8, title: "Old title", content: { description: "Old content" } },
          { id: 9, title: "Keep me" },
        ],
      },
    ],
  };

  const updated = replaceActivityInBuilderData(data, {
    id: 8,
    title: "New title",
    content: { description: "New content" },
  });

  expect(updated.modules[0].activities[0]).toEqual({
    id: 8,
    title: "New title",
    content: { description: "New content" },
  });
  expect(updated.modules[0].activities[1]).toBe(data.modules[0].activities[1]);
  expect(updated.template.version).toBe(4);
});
