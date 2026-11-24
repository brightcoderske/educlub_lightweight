import { loadPyodide } from "pyodide";

import {
  boundedPythonText,
  isPythonRunnerMessage,
  learnerFacingError,
  PYTHON_MAX_SOURCE_LENGTH,
  createPythonConsole,
  pythonRunnerMessage,
  sanitizeClicked,
  sanitizePageFields,
  sanitizeSeed,
} from "./protocol";

const PYODIDE_VERSION = "314.0.6";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const safeJavaScriptGlobals = Object.freeze(Object.create(null));

let pyodidePromise;

function appendOutput(current, addition) {
  return boundedPythonText(current ? `${current}\n${addition}` : addition);
}

async function initializePyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
      jsglobals: safeJavaScriptGlobals,
      env: { HOME: "/home/pyodide" },
    }).then(async (pyodide) => {
      // These imports expose browser/network bridges or package installation.
      // The custom jsglobals object and runner CSP are the real boundaries; the
      // import guard is an extra learner-friendly failure mode.
      await pyodide.runPythonAsync(`
import builtins

def _educlub_make_import_guard(original_import):
    blocked = {"js", "pyodide_js", "micropip", "webbrowser", "socket", "requests", "aiohttp"}
    blocked_prefixes = ("pyodide.http",)
    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        root = name.split(".", 1)[0]
        if root in blocked or name.startswith(blocked_prefixes):
            raise ImportError(f"{name} is unavailable in the safe eduClub runner")
        return original_import(name, globals, locals, fromlist, level)
    return guarded_import

builtins.__import__ = _educlub_make_import_guard(builtins.__import__)
del _educlub_make_import_guard
`);
      return pyodide;
    });
  }
  return pyodidePromise;
}

async function runPython({ code, inputs = [], seed, page, clicked }) {
  const source = String(code || "");
  if (!source.trim()) throw new Error("Add some Python code before selecting Run Python.");
  if (source.length > PYTHON_MAX_SOURCE_LENGTH) {
    throw new Error(
      `Python code is limited to ${PYTHON_MAX_SOURCE_LENGTH.toLocaleString()} characters.`
    );
  }

  const pyodide = await initializePyodide();
  let stdout = "";
  let stderr = "";
  // Plain programs get a terminal-like console where input() waits for the
  // learner. Python + HTML pages have no console: their input comes from `page`.
  const terminal = page === undefined ? createPythonConsole(inputs) : null;

  if (terminal) {
    const decoder = new TextDecoder();
    pyodide.setStdout({
      write: (buffer) => {
        terminal.write(decoder.decode(buffer, { stream: true }));
        return buffer.length;
      },
    });
  } else {
    pyodide.setStdout({ batched: (text) => (stdout = appendOutput(stdout, text)) });
  }
  pyodide.setStderr({ batched: (text) => (stderr = appendOutput(stderr, text)) });
  pyodide.setStdin({ stdin: () => (terminal ? terminal.readLine() : null), autoEOF: true });

  // Each answer replays the program from the top; the same seed makes random
  // pick the same numbers again, so the replay matches what the learner saw.
  const randomSeed = sanitizeSeed(seed);
  if (randomSeed !== null) pyodide.runPython(`import random\nrandom.seed(${randomSeed})`);

  const globals = pyodide.globals.get("dict")();
  globals.set("__name__", "__main__");
  let pageDict;
  if (page !== undefined) {
    // Python + HTML activities: the page's field values as a dict of text, and
    // which button was clicked. Data only - built from sanitized string pairs,
    // never a proxy onto anything JavaScript.
    pageDict = pyodide.toPy(new Map(sanitizePageFields(page)));
    globals.set("page", pageDict);
    globals.set("clicked", sanitizeClicked(clicked));
  }
  let result;
  let failure;
  try {
    result = await pyodide.runPythonAsync(source, {
      globals,
      locals: globals,
      filename: "learner.py",
    });
  } catch (error) {
    failure = error;
  } finally {
    // The console's stdout is buffered; flush it so the last print is shown.
    pyodide.runPython("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
    pageDict?.destroy();
    globals.destroy();
  }

  let displayResult = "";
  if (result !== undefined && result !== null) displayResult = boundedPythonText(String(result));
  if (result && typeof result.destroy === "function") result.destroy();
  if (terminal?.awaitingInput) {
    // Waiting for an answer is not an error, even though Python saw EOFError.
    return { stdout: terminal.text, stderr, result: "", awaitingInput: true };
  }
  if (failure) {
    // What the program printed before the error stays on screen above it.
    failure.stdout = terminal ? terminal.text : stdout;
    throw failure;
  }
  return { stdout: terminal ? terminal.text : stdout, stderr, result: displayResult };
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (!isPythonRunnerMessage(message) || message.type !== "run") return;
  const startedAt = performance.now();
  try {
    const output = await runPython(message);
    self.postMessage(
      pythonRunnerMessage("result", {
        id: message.id,
        ok: true,
        ...output,
        durationMs: Math.round(performance.now() - startedAt),
      })
    );
  } catch (error) {
    self.postMessage(
      pythonRunnerMessage("result", {
        id: message.id,
        ok: false,
        stdout: typeof error?.stdout === "string" ? error.stdout : "",
        // Pyodide's own frames sit above the learner's; strip them so the
        // message a beginner reads starts at their own code.
        error: boundedPythonText(
          learnerFacingError(error?.message) || "Python could not run this program."
        ),
        durationMs: Math.round(performance.now() - startedAt),
      })
    );
  }
});

initializePyodide()
  .then(() => self.postMessage(pythonRunnerMessage("ready")))
  .catch((error) =>
    self.postMessage(
      pythonRunnerMessage("startup_error", {
        error: boundedPythonText(error?.message || "The Python runtime could not start."),
      })
    )
  );
