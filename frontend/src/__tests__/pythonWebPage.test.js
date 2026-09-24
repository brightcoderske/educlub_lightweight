import {
  attachPythonWebBridge,
  hasCodeWorkspace,
  isPythonActivity,
  isPythonWebActivity,
  PYTHON_PAGE_SOURCE,
  pythonWebHtml,
  pythonWebPreview,
  scriptsAllowed,
} from "../layouts/learner/module-learn/activityContent";
import {
  PYTHON_PAGE_MAX_FIELDS,
  PYTHON_PAGE_MAX_VALUE_LENGTH,
  sanitizeClicked,
  sanitizePageFields,
} from "../python-runner/protocol";

// Python + HTML activities: the page is HTML/CSS, the program is Python, and
// buttons on the page run the Python. These tests pin the boundaries: the page
// gets no learner JavaScript, Python gets only bounded text, and only the
// preview frame itself can ask for a run.

describe("Python + HTML activity detection", () => {
  test("python_html is its own language, separate from plain Python and web", () => {
    expect(isPythonWebActivity({ language: "python_html" })).toBe(true);
    expect(isPythonWebActivity({ language: " PYTHON_HTML " })).toBe(true);
    expect(isPythonWebActivity({ language: "python" })).toBe(false);
    expect(isPythonActivity({ language: "python_html" })).toBe(false);
    expect(hasCodeWorkspace({ language: "python_html" })).toBe(false);
    expect(scriptsAllowed({ language: "python_html" })).toBe(false);
  });
});

describe("pythonWebPreview", () => {
  test("keeps the restrictive CSP and strips every learner script", () => {
    const out = pythonWebPreview(
      "<p>hi</p><script>steal()</script><script src=x>",
      "p{color:red}",
      1
    );
    expect(out).toContain("default-src 'none'");
    expect(out).not.toContain("connect-src");
    expect(out).not.toContain("steal()");
    expect(out).not.toContain("src=x");
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("p{color:red}");
    expect(out).toContain(PYTHON_PAGE_SOURCE);
  });

  test("each run is a different document, so Run always reloads the page", () => {
    expect(pythonWebPreview("<p>x</p>", "", 1)).not.toBe(pythonWebPreview("<p>x</p>", "", 2));
  });
});

describe("pythonWebHtml", () => {
  test("printed HTML is shown as HTML", () => {
    expect(pythonWebHtml({ stdout: "<h2>Total: 450</h2>" })).toBe("<h2>Total: 450</h2>");
  });

  test("plain printed text is escaped and keeps its line breaks", () => {
    const out = pythonWebHtml({ stdout: "5 > 3\nyes & no" });
    expect(out).toContain("5 &gt; 3\nyes &amp; no");
    expect(out).toContain("pre-wrap");
  });

  test("errors appear escaped, after anything printed first", () => {
    const out = pythonWebHtml({ stdout: "<p>ok</p>", error: "NameError: <img onerror=x>" });
    expect(out.startsWith("<p>ok</p>")).toBe(true);
    expect(out).toContain("NameError: &lt;img onerror=x&gt;");
  });
});

describe("page field sanitizing", () => {
  test("only bounded text survives", () => {
    const many = Object.fromEntries(
      Array.from({ length: PYTHON_PAGE_MAX_FIELDS + 10 }, (_, i) => [`f${i}`, "v"])
    );
    expect(sanitizePageFields(many)).toHaveLength(PYTHON_PAGE_MAX_FIELDS);
    const [[, long]] = sanitizePageFields({ note: "x".repeat(PYTHON_PAGE_MAX_VALUE_LENGTH + 5) });
    expect(long).toHaveLength(PYTHON_PAGE_MAX_VALUE_LENGTH);
    expect(sanitizePageFields({ ok: 5, nested: { a: 1 }, list: [1] })).toEqual([["ok", "5"]]);
    expect(sanitizePageFields(null)).toEqual([]);
    expect(sanitizePageFields(["a"])).toEqual([]);
    expect(sanitizeClicked({ id: "x" })).toBe("");
    expect(sanitizeClicked("calculate")).toBe("calculate");
  });
});

describe("attachPythonWebBridge", () => {
  function makeFrame() {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    document.body.appendChild(frame);
    frame.contentWindow.postMessage = jest.fn();
    return frame;
  }

  function send(data, source) {
    const event = new window.MessageEvent("message", { data });
    Object.defineProperty(event, "source", { value: source, configurable: true });
    window.dispatchEvent(event);
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("a click in the frame runs Python with sanitized fields and shows the result", async () => {
    const frame = makeFrame();
    const onRun = jest.fn().mockResolvedValue("<b>Hello Amina</b>");
    attachPythonWebBridge(frame, onRun);
    send(
      {
        source: PYTHON_PAGE_SOURCE,
        type: "run",
        fields: { name: "Amina", bad: { x: 1 } },
        clicked: "greet",
      },
      frame.contentWindow
    );
    await flush();
    expect(onRun).toHaveBeenCalledWith({ fields: { name: "Amina" }, clicked: "greet" });
    expect(frame.contentWindow.postMessage).toHaveBeenLastCalledWith(
      { source: PYTHON_PAGE_SOURCE, type: "show", html: "<b>Hello Amina</b>" },
      "*"
    );
  });

  test("it says hello on attach so a page that loaded first can ask again", () => {
    const frame = makeFrame();
    attachPythonWebBridge(frame, jest.fn());
    expect(frame.contentWindow.postMessage).toHaveBeenCalledWith(
      { source: PYTHON_PAGE_SOURCE, type: "hello" },
      "*"
    );
  });

  test("requests from any other window, or of another shape, are ignored", async () => {
    const frame = makeFrame();
    const onRun = jest.fn().mockResolvedValue("");
    attachPythonWebBridge(frame, onRun);
    send({ source: PYTHON_PAGE_SOURCE, type: "run", fields: {} }, window);
    send({ source: "somewhere-else", type: "run", fields: {} }, frame.contentWindow);
    send({ source: PYTHON_PAGE_SOURCE, type: "show", html: "x" }, frame.contentWindow);
    await flush();
    expect(onRun).not.toHaveBeenCalled();
  });

  test("clicks during a run are dropped, not queued", async () => {
    const frame = makeFrame();
    let finish;
    const onRun = jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    attachPythonWebBridge(frame, onRun);
    const click = { source: PYTHON_PAGE_SOURCE, type: "run", fields: {}, clicked: "go" };
    send(click, frame.contentWindow);
    send(click, frame.contentWindow);
    send(click, frame.contentWindow);
    expect(onRun).toHaveBeenCalledTimes(1);
    finish("<p>done</p>");
    await flush();
    send(click, frame.contentWindow);
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  test("a failed run shows a readable error on the page", async () => {
    const frame = makeFrame();
    attachPythonWebBridge(frame, jest.fn().mockRejectedValue(new Error("took too long")));
    send({ source: PYTHON_PAGE_SOURCE, type: "run", fields: {} }, frame.contentWindow);
    await flush();
    const [[message]] = frame.contentWindow.postMessage.mock.calls.slice(-1);
    expect(message.type).toBe("show");
    expect(message.html).toContain("took too long");
  });

  test("cleanup stops it listening", async () => {
    const frame = makeFrame();
    const onRun = jest.fn().mockResolvedValue("");
    const stop = attachPythonWebBridge(frame, onRun);
    stop();
    send({ source: PYTHON_PAGE_SOURCE, type: "run", fields: {} }, frame.contentWindow);
    await flush();
    expect(onRun).not.toHaveBeenCalled();
  });
});
