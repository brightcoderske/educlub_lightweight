import {
  attachPreviewAutoHeight,
  hasCodeWorkspace,
  isPythonActivity,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MIN_HEIGHT,
  PREVIEW_SANDBOX,
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

describe("isPythonActivity", () => {
  test("recognises Python without treating other single-editor languages as Python", () => {
    expect(isPythonActivity({ language: "python" })).toBe(true);
    expect(isPythonActivity({ language: " PYTHON " })).toBe(true);
    expect(isPythonActivity({ language: "javascript" })).toBe(false);
    expect(isPythonActivity({})).toBe(false);
  });
});

describe("webPreview behaves like a real page, walled off from eduClub", () => {
  test("the JavaScript box and scripts in the HTML both run", () => {
    const out = webPreview("<p>hi</p><script>inline()</script>", "", "run()");
    expect(out).toContain("inline()");
    expect(out).toContain("run()");
  });

  test("outside pictures, fonts, media and https requests are allowed", () => {
    const out = webPreview("<p>hi</p>");
    expect(out).toContain("default-src 'none'");
    expect(out).toMatch(/img-src https: data: blob:/);
    expect(out).toMatch(/font-src https:/);
    expect(out).toMatch(/media-src https:/);
    expect(out).toMatch(/connect-src https:/);
    // Plain http and other schemes stay out.
    expect(out).not.toMatch(/http:/);
  });

  test("a form never navigates away and the base address cannot be changed", () => {
    const out = webPreview("<form><button>Go</button></form>");
    expect(out).toContain("form-action 'none'");
    expect(out).toContain("base-uri 'none'");
  });

  test("the frame never shares eduClub's origin or can move the app's page", () => {
    const flags = PREVIEW_SANDBOX.split(" ");
    expect(flags).toEqual(expect.arrayContaining(["allow-scripts", "allow-modals", "allow-popups"]));
    expect(flags).not.toContain("allow-same-origin");
    expect(flags.some((flag) => flag.startsWith("allow-top-navigation"))).toBe(false);
  });

  test("the page helper runs before the learner's code", () => {
    const out = webPreview("<p>x</p>", "", "localStorage.setItem('a', 1)");
    expect(out.indexOf('closest("a[href]")')).toBeGreaterThan(-1);
    expect(out.indexOf('closest("a[href]")')).toBeLessThan(out.indexOf("localStorage.setItem('a', 1)"));
  });
});

describe("the page helper inside a frame", () => {
  // Runs the helper the way the frame would, in this test's window.
  function runHelper() {
    const doc = new DOMParser().parseFromString(webPreview("<p>x</p>"), "text/html");
    const helper = [...doc.querySelectorAll("script")].find((s) => s.textContent.includes("memoryStorage"));
    // eslint-disable-next-line no-new-func
    new Function(helper.textContent)();
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("an outside link opens in a new tab and a #section link stays in the page", () => {
    runHelper();
    // Registered after the helper, so it runs second: it only stops jsdom
    // trying to follow the link.
    const stopNavigation = (event) => event.preventDefault();
    document.addEventListener("click", stopNavigation);
    document.body.innerHTML = '<a id="out" href="https://example.org">out</a><a id="in" href="#top">in</a>';
    const click = (id) =>
      document.getElementById(id).dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    click("out");
    click("in");
    expect(document.getElementById("out").target).toBe("_blank");
    expect(document.getElementById("out").rel).toBe("noopener");
    expect(document.getElementById("in").target).toBe("");
    document.removeEventListener("click", stopNavigation);
  });
});

describe("preview auto-height", () => {
  function makeFrame() {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    document.body.appendChild(frame);
    return frame;
  }

  function report(frame, height, source) {
    const event = new window.MessageEvent("message", {
      data: { source: "educlub-preview", height },
    });
    Object.defineProperty(event, "source", { value: source, configurable: true });
    window.dispatchEvent(event);
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("the frame grows to the height its content reports", () => {
    const frame = makeFrame();
    attachPreviewAutoHeight(frame);
    report(frame, 940, frame.contentWindow);
    expect(frame.style.height).toBe("964px");
  });

  test("a message from any other window is ignored", () => {
    const frame = makeFrame();
    attachPreviewAutoHeight(frame);
    report(frame, 940, frame.contentWindow);
    report(frame, 50, window); // spoof from the parent itself
    expect(frame.style.height).toBe("964px");
  });

  test("heights are clamped at both ends", () => {
    const frame = makeFrame();
    attachPreviewAutoHeight(frame);
    report(frame, 99999, frame.contentWindow);
    expect(frame.style.height).toBe(`${PREVIEW_MAX_HEIGHT}px`);
    report(frame, 10, frame.contentWindow);
    expect(frame.style.height).toBe(`${PREVIEW_MIN_HEIGHT}px`);
  });

  test("rubbish payloads are ignored", () => {
    const frame = makeFrame();
    attachPreviewAutoHeight(frame);
    report(frame, "tall", frame.contentWindow);
    const event = new window.MessageEvent("message", {
      data: { source: "somewhere-else", height: 900 },
    });
    Object.defineProperty(event, "source", { value: frame.contentWindow, configurable: true });
    window.dispatchEvent(event);
    expect(frame.style.height).toBe("");
  });

  test("cleanup stops it listening", () => {
    const frame = makeFrame();
    const stop = attachPreviewAutoHeight(frame);
    stop();
    report(frame, 940, frame.contentWindow);
    expect(frame.style.height).toBe("");
  });

  test("every preview ships the reporter, with or without a JavaScript box", () => {
    expect(webPreview("<p>x</p>", "", "go()")).toContain("educlub-preview");
    expect(webPreview("<p>x</p>")).toContain("educlub-preview");
  });

  test("the reporter does not displace the learner's own code", () => {
    const out = webPreview("<p>x</p>", "", "const mine = 42;");
    expect(out).toContain("const mine = 42;");
    expect(out).toContain("educlub-preview");
  });
});
