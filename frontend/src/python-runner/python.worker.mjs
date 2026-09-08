import { loadPyodide } from "pyodide";

import {
  boundedPythonText,
  isPythonRunnerMessage,
  learnerFacingError,
  PYTHON_MAX_SOURCE_LENGTH,
  pythonRunnerMessage,
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

async function runPython({ code, inputs = [] }) {
  const source = String(code || "");
  if (!source.trim()) throw new Error("Add some Python code before selecting Run Python.");
  if (source.length > PYTHON_MAX_SOURCE_LENGTH) {
    throw new Error(
      `Python code is limited to ${PYTHON_MAX_SOURCE_LENGTH.toLocaleString()} characters.`
    );
  }

  const pyodide = await initializePyodide();
  const inputQueue = Array.isArray(inputs) ? inputs.map((value) => String(value)) : [];
  let stdout = "";
  let stderr = "";

  pyodide.setStdout({ batched: (text) => (stdout = appendOutput(stdout, text)) });
  pyodide.setStderr({ batched: (text) => (stderr = appendOutput(stderr, text)) });
  pyodide.setStdin({
    stdin: () => (inputQueue.length ? inputQueue.shift() : null),
    autoEOF: true,
  });

  const globals = pyodide.globals.get("dict")();
  globals.set("__name__", "__main__");
  try {
    const result = await pyodide.runPythonAsync(source, {
      globals,
      locals: globals,
      filename: "learner.py",
    });
    let displayResult = "";
    if (result !== undefined && result !== null) displayResult = boundedPythonText(String(result));
    if (result && typeof result.destroy === "function") result.destroy();
    return { stdout, stderr, result: displayResult };
  } finally {
    globals.destroy();
  }
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
