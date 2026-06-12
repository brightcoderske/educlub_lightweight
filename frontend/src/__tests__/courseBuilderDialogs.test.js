import {
  buildEarlyUnlockPayload,
  displayCodeBlockHtml,
  executableBlockHtml,
  executableSourceFromPayload,
  resourceHtml,
} from "../layouts/course-builder/dialogs/authoringUtils";

test("resource links accept explicit web URLs and escape teacher text", () => {
  expect(
    resourceHtml({
      type: "link",
      url: "https://example.com/lesson?a=1&b=2",
      label: 'Read "this" <lesson>',
    })
  ).toContain("Read &quot;this&quot; &lt;lesson&gt;");
  expect(() => resourceHtml({ type: "link", url: "javascript:alert(1)", label: "Bad" })).toThrow(
    /http/i
  );
});

test("one executable source editor remains compatible with learner payloads", () => {
  const source =
    "<style>h1 { color: teal; }</style><h1>Hello</h1><script>document.body.dataset.ok = '1';</script>";
  const html = executableBlockHtml({ source, title: "Try this" });
  const encoded = html.match(/data-executable-code="([^"]+)"/)[1];
  const payload = JSON.parse(decodeURIComponent(encoded));

  expect(payload.html).toContain("<h1>Hello</h1>");
  expect(payload.css).toContain("color: teal");
  expect(payload.js).toContain("dataset.ok");
  expect(executableSourceFromPayload(encoded)).toContain("<script>");
});

test("display code blocks keep language and visible title metadata", () => {
  const html = displayCodeBlockHtml({
    code: "print('Hello')",
    language: "python",
    title: "Worked example",
  });

  expect(html).toContain('data-code-language="python"');
  expect(html).toContain("Worked example");
  expect(html).toContain("print(&#039;Hello&#039;)");
});

test("early unlock payloads use selected learner records, not typed IDs", () => {
  expect(
    buildEarlyUnlockPayload({
      scopeType: "learners",
      learnerIds: [14, 22],
      moduleId: 3,
      activityId: 8,
      reason: "Support session",
    })
  ).toEqual({
    scope_type: "learners",
    learner_ids: [14, 22],
    module_id: 3,
    activity_id: 8,
    reason: "Support session",
  });

  expect(() =>
    buildEarlyUnlockPayload({
      scopeType: "learner",
      learnerIds: [],
      moduleId: 3,
      reason: "Support session",
    })
  ).toThrow(/learner/i);
});
