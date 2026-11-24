import {
  friendlyPythonError,
  nextRunPhase,
  PYTHON_DRAWING_TIMEOUT_MS,
  PYTHON_EXECUTION_TIMEOUT_MS,
  PYTHON_MAX_IMAGES,
  PYTHON_PACKAGE_TIMEOUT_MS,
  pythonRunnerMessage,
  runPhaseTimeout,
  runPhaseTimeoutMessage,
  sanitizeNotices,
  sanitizePythonImages,
  withoutInstallLines,
} from "../python-runner/protocol";
import {
  ALWAYS_BLOCKED_IMPORTS,
  EXPLAINED_IMPORTS,
  importGuardPython,
  NEVER_LOADED_IMPORTS,
  PLOT_LIMITS,
  runtimePython,
} from "../python-runner/pythonRuntime";
import {
  disposePythonRunner,
  formatPythonResult,
  runPythonInBrowser,
} from "../lib/pythonRunnerClient";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const GIF = "data:image/gif;base64,R0lGODlh";

describe("pip install and notebook lines", () => {
  test.each([
    "pip install numpy",
    "!pip install numpy",
    "%pip install numpy",
    "  pip3 install numpy",
    "python -m pip install numpy",
    "conda install numpy",
  ])("%s is skipped with a kind note, keeping line numbers", (line) => {
    const { code, notices } = withoutInstallLines(`${line}\nimport numpy as np\nprint(np.pi)`);
    expect(code.split("\n")).toEqual(["", "import numpy as np", "print(np.pi)"]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/^Line 1: nothing needs installing here/);
    expect(notices[0]).toContain("numpy loads by itself when you import it.");
  });

  test("several libraries and version pins are named plainly", () => {
    const { notices } = withoutInstallLines("!pip install -q pandas==2.2 matplotlib>=3");
    expect(notices[0]).toContain("pandas, matplotlib load by themselves when you import them.");
  });

  test("%matplotlib inline is skipped, other code is untouched", () => {
    const source = "%matplotlib inline\nimport matplotlib.pyplot as plt";
    const { code, notices } = withoutInstallLines(source);
    expect(code).toBe("\nimport matplotlib.pyplot as plt");
    expect(notices[0]).toContain("notebook command");

    const plain = "pipe = 'pip install x'\nprint(pipe)";
    expect(withoutInstallLines(plain)).toEqual({ code: plain, notices: [] });
  });
});

describe("plain words for what cannot work in a browser", () => {
  const traceback = (frameLine, last) =>
    [
      "Traceback (most recent call last):",
      '  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async',
      `  File "learner.py", line ${frameLine}, in <module>`,
      "    import thing",
      last,
    ].join("\n");

  test("an explained import becomes one sentence with its line", () => {
    const message = friendlyPythonError(
      traceback(3, "ModuleNotFoundError: [educlub] turtle draws in a desktop window.")
    );
    expect(message).toBe("Line 3: turtle draws in a desktop window.");
  });

  test("Pyodide's extra install lines and the guard's own frame are looked past", () => {
    const raw = [
      "Traceback (most recent call last):",
      '  File "learner.py", line 2, in <module>',
      "    import pygame",
      '  File "<exec>", line 26, in guarded_import',
      "ModuleNotFoundError: [educlub] pygame opens a game window.",
      "The module 'pygame-ce' is included in the Pyodide distribution, but it is not installed.",
      "You can install it by calling:",
      '  await micropip.install("pygame-ce") in Python, or',
    ].join("\n");
    expect(friendlyPythonError(raw)).toBe("Line 2: pygame opens a game window.");
  });

  test("a library that does not exist gets a hint, not a traceback", () => {
    const message = friendlyPythonError(
      traceback(1, "ModuleNotFoundError: No module named 'flask'")
    );
    expect(message).toMatch(/^Line 1: there is no library called "flask" here/);
    expect(message).toContain("load by themselves");
    expect(message).not.toContain("Traceback");
  });

  test("other errors keep the learner's trimmed traceback", () => {
    const message = friendlyPythonError(traceback(2, "NameError: name 'x' is not defined"));
    expect(message).toContain('File "learner.py", line 2');
    expect(message).not.toContain("_base.py");
  });

  test("the guard explains windows, games, the network and installing", () => {
    for (const name of ["tkinter", "turtle", "pygame", "requests", "socket", "micropip", "pip"]) {
      expect(EXPLAINED_IMPORTS[name] || ALWAYS_BLOCKED_IMPORTS.includes(name)).toBeTruthy();
    }
    expect(EXPLAINED_IMPORTS.requests).toContain("offline");
    expect(EXPLAINED_IMPORTS.pygame).toContain("window");
    // Blocked names are never downloaded, even though Pyodide has builds of them.
    for (const name of ["micropip", "requests", "pygame", "js", "pyodide_js"]) {
      expect(NEVER_LOADED_IMPORTS.has(name)).toBe(true);
    }
    expect(NEVER_LOADED_IMPORTS.has("numpy")).toBe(false);
    const guard = importGuardPython();
    expect(guard).toContain('"micropip"');
    expect(guard).toContain('globals.get("__name__") == "__main__"');
  });
});

describe("run phases and their clocks", () => {
  test("library downloads and drawing do not count against the 3 seconds", () => {
    expect(runPhaseTimeout("start")).toBe(PYTHON_EXECUTION_TIMEOUT_MS);
    expect(runPhaseTimeout("running")).toBe(PYTHON_EXECUTION_TIMEOUT_MS);
    expect(runPhaseTimeout("loading")).toBe(PYTHON_PACKAGE_TIMEOUT_MS);
    expect(runPhaseTimeout("drawing")).toBe(PYTHON_DRAWING_TIMEOUT_MS);
    expect(runPhaseTimeoutMessage("running")).toContain("3 seconds");
    expect(runPhaseTimeoutMessage("loading")).toContain("internet connection");
  });

  test("phases only move forward, so a run can never reset its clock", () => {
    expect(nextRunPhase("start", "loading")).toBe("loading");
    expect(nextRunPhase("start", "running")).toBe("running");
    expect(nextRunPhase("loading", "running")).toBe("running");
    expect(nextRunPhase("running", "drawing")).toBe("drawing");
    expect(nextRunPhase("running", "loading")).toBeNull();
    expect(nextRunPhase("running", "running")).toBeNull();
    expect(nextRunPhase("drawing", "running")).toBeNull();
    expect(nextRunPhase("start", "bogus")).toBeNull();
  });
});

describe("charts come back as pictures only", () => {
  test("only PNG and GIF data URLs survive", () => {
    const images = sanitizePythonImages([
      { kind: "image", src: PNG },
      { kind: "animation", src: GIF, note: "cut short" },
      { kind: "image", src: "data:text/html;base64,PHNjcmlwdD4=" },
      { kind: "image", src: "data:image/svg+xml;base64,PHN2Zz4=" },
      { kind: "image", src: "https://example.com/x.png" },
      { kind: "image", src: `${PNG}"><script>` },
      { kind: "image", src: 42 },
      null,
    ]);
    expect(images).toEqual([
      { kind: "image", src: PNG, note: "" },
      { kind: "animation", src: GIF, note: "cut short" },
    ]);
    expect(sanitizePythonImages("nope")).toEqual([]);
    const many = Array.from({ length: 20 }, () => ({ kind: "image", src: PNG }));
    expect(sanitizePythonImages(many)).toHaveLength(PYTHON_MAX_IMAGES);
  });

  test("notices are short text only", () => {
    expect(sanitizeNotices(["a", 3, null, "x".repeat(1000)])).toEqual(["a", "x".repeat(400)]);
  });

  test("the plot runtime uses Agg, caps animations and never returns HTML", () => {
    const runtime = runtimePython();
    expect(runtime).toContain('matplotlib.use("Agg", force=True)');
    expect(runtime).toContain('format="GIF"');
    expect(runtime).not.toContain("to_jshtml");
    expect(PLOT_LIMITS.maxGifFrames).toBeLessThanOrEqual(60);
    expect(PLOT_LIMITS.maxAnimationSide).toBeLessThanOrEqual(480);
    expect(PLOT_LIMITS.maxImages).toBeLessThanOrEqual(PYTHON_MAX_IMAGES);
  });
});

describe("output box with notes and charts", () => {
  test("notes come first, then the program's output", () => {
    expect(formatPythonResult({ notices: ["Line 1: skipped."], stdout: "hi" })).toBe(
      "Line 1: skipped.\n\nhi"
    );
  });

  test("a program that only draws a chart does not say it had no output", () => {
    expect(formatPythonResult({ images: [{ kind: "image", src: PNG }] })).toBe("");
    expect(formatPythonResult({})).toBe("Program finished with no output.");
  });

  test("a program waiting at input() shows exactly what it printed", () => {
    expect(formatPythonResult({ awaitingInput: true, stdout: "Name? " })).toBe("Name? ");
    expect(
      formatPythonResult({ awaitingInput: true, stdout: "Name? ", notices: ["Line 1: skipped."] })
    ).toBe("Line 1: skipped.\n\nName? ");
  });
});

describe("client: loading status and pictures", () => {
  afterEach(() => {
    disposePythonRunner();
    document.body.innerHTML = "";
  });

  function dispatch(iframe, origin, data) {
    const event = new window.MessageEvent("message", { data, origin });
    Object.defineProperty(event, "source", { value: iframe.contentWindow, configurable: true });
    window.dispatchEvent(event);
  }

  test("'Loading numpy…' reaches onStatus and only safe pictures come back", async () => {
    const statuses = [];
    const runPromise = runPythonInBrowser("import numpy", {
      onStatus: (status) => statuses.push(status),
    });
    const iframe = document.querySelector('iframe[title="Secure Python runner"]');
    const origin = new URL(iframe.src).origin;
    const postMessage = jest.fn();
    iframe.contentWindow.postMessage = postMessage;
    dispatch(iframe, origin, pythonRunnerMessage("ready"));
    await Promise.resolve();
    await Promise.resolve();
    const [request] = postMessage.mock.calls[0];

    dispatch(iframe, "https://attacker.example", pythonRunnerMessage("status", { id: request.id, text: "evil" }));
    dispatch(
      iframe,
      origin,
      pythonRunnerMessage("status", { id: request.id, text: "Loading numpy… (first time only)" })
    );
    expect(statuses).toContain("Loading numpy… (first time only)");
    expect(statuses).not.toContain("evil");

    dispatch(
      iframe,
      origin,
      pythonRunnerMessage("result", {
        id: request.id,
        ok: true,
        stdout: "",
        images: [{ kind: "image", src: PNG }, { kind: "image", src: "javascript:alert(1)" }],
      })
    );
    const result = await runPromise;
    expect(result.images).toEqual([{ kind: "image", src: PNG, note: "" }]);
    expect(result.output).toBe("");
  });
});
