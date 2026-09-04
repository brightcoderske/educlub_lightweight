import {
  hasCodeWorkspace,
  scriptsAllowed,
  webPreview,
} from "../layouts/learner/module-learn/activityContent";

// An activity that ships starter_js but whose language forbids scripts used to
// render with the JavaScript silently dropped: the learner met buttons that did
// nothing and no explanation anywhere. Every interactive AI1 activity shipped
// that way once. These tests exist so it cannot happen again.

describe("scriptsAllowed", () => {
  test("html_css_js enables scripts", () => {
    expect(scriptsAllowed({ language: "html_css_js" })).toBe(true);
    expect(scriptsAllowed({ language: "HTML_CSS_JS" })).toBe(true);
  });

  test("non-empty starter_js enables scripts whatever the language says", () => {
    expect(scriptsAllowed({ language: "html_css", starter_js: "alert(1)" })).toBe(true);
    expect(scriptsAllowed({ starter_js: "const a = 1;" })).toBe(true);
  });

  test("no js means no scripts", () => {
    expect(scriptsAllowed({ language: "html_css" })).toBe(false);
    expect(scriptsAllowed({ language: "html_css", starter_js: "" })).toBe(false);
    expect(scriptsAllowed({ language: "html_css", starter_js: "   " })).toBe(false);
    expect(scriptsAllowed({})).toBe(false);
  });

  test("a language with no code workspace still gets no scripts without js", () => {
    expect(scriptsAllowed({ language: "python" })).toBe(false);
  });
});

describe("hasCodeWorkspace", () => {
  test("shows the HTML/CSS editors for the web languages only", () => {
    expect(hasCodeWorkspace({ language: "html_css" })).toBe(true);
    expect(hasCodeWorkspace({ language: "html_css_js" })).toBe(true);
    expect(hasCodeWorkspace({ language: "python" })).toBe(false);
    expect(hasCodeWorkspace({})).toBe(false);
  });
});

describe("webPreview keeps its sandbox promises", () => {
  test("scripts are stripped when JavaScript is not allowed", () => {
    const out = webPreview("<p>hi</p><script>steal()</script>", "", "run()", false);
    expect(out).not.toContain("steal()");
    expect(out).not.toContain("run()");
  });

  test("scripts are included when JavaScript is allowed", () => {
    const out = webPreview("<p>hi</p>", "", "run()", true);
    expect(out).toContain("run()");
  });

  test("the restrictive CSP is always present, scripts or not", () => {
    for (const allow of [true, false]) {
      const out = webPreview("<p>hi</p>", "", "run()", allow);
      expect(out).toContain("Content-Security-Policy");
      expect(out).toContain("default-src 'none'");
      // No network access from learner code, in either mode.
      expect(out).not.toContain("connect-src");
    }
  });

  test("an activity carrying starter_js renders it, end to end", () => {
    const content = { language: "html_css", starter_js: "document.title = 'ran'" };
    const out = webPreview("<p>x</p>", "", content.starter_js, scriptsAllowed(content));
    expect(out).toContain("document.title = 'ran'");
  });
});
