import {
  buildEarlyUnlockPayload,
  displayCodeBlockHtml,
  executableBlockHtml,
  executableSourceFromPayload,
  hintBlockHtml,
  interactiveBlockHtml,
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

test("rich text hints are collapsible and safely escaped", () => {
  const html = hintBlockHtml({
    title: "Need a hint?",
    body: 'Look for the <main> element & its "heading".',
  });

  expect(html).toContain("data-hint-block");
  expect(html).toContain("<details");
  expect(html).toContain("&lt;main&gt;");
  expect(html).toContain("&quot;heading&quot;");
});

test("interactive rich-content blocks preserve editable prompts and answers", () => {
  const flashCard = interactiveBlockHtml({
    type: "flash_card",
    title: "Key term",
    prompt: "What is a variable?",
    answer: "A named place that stores a value.",
  });
  const reveal = interactiveBlockHtml({
    type: "reveal",
    title: "Reveal the explanation",
    prompt: "Why do loops help?",
    answer: "They repeat instructions without duplicating code.",
  });
  const selfCheck = interactiveBlockHtml({
    type: "self_check",
    title: "Quick check",
    prompt: "Which block starts a Scratch project?",
    answer: "When green flag clicked.",
  });

  expect(flashCard).toContain('data-interactive-block="flash_card"');
  expect(flashCard).toContain('data-block-prompt="What is a variable?"');
  expect(flashCard).toContain("Show answer");
  expect(reveal).toContain('data-interactive-block="reveal"');
  expect(reveal).toContain("<details");
  expect(selfCheck).toContain('data-interactive-block="self_check"');
  expect(selfCheck).toContain("Check answer");
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
