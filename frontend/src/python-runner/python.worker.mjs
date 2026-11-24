import { loadPyodide } from "pyodide";

import {
  boundedPythonText,
  createPythonConsole,
  friendlyPythonError,
  isPythonRunnerMessage,
  PYTHON_MAX_SOURCE_LENGTH,
  pythonRunnerMessage,
  sanitizeClicked,
  sanitizePageFields,
  sanitizeSeed,
  withoutInstallLines,
} from "./protocol";
import { importGuardPython, NEVER_LOADED_IMPORTS, runtimePython } from "./pythonRuntime";

const PYODIDE_VERSION = "314.0.6";
// Libraries come from the same jsDelivr folder as Pyodide itself, which is the
// only address the runner CSP lets it connect to.
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const safeJavaScriptGlobals = Object.freeze(Object.create(null));

let pyodidePromise;
let importToPackage;

function appendOutput(current, addition) {
  return boundedPythonText(current ? `${current}\n${addition}` : addition);
}

async function initializePyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      indexURL: PYODIDE_INDEX_URL,
      jsglobals: safeJavaScriptGlobals,
      // Agg draws into memory; charts come back as pictures, never windows.
      env: { HOME: "/home/pyodide", MPLBACKEND: "Agg" },
    }).then(async (pyodide) => {
      // Guard: "js", "pyodide_js", "micropip" and "pyodide.http" are never
      // importable; desktop-window and network libraries get a plain reason.
      await pyodide.runPythonAsync(importGuardPython());
      await pyodide.runPythonAsync(runtimePython());
      return pyodide;
    });
  }
  return pyodidePromise;
}

/** Which Pyodide package provides each importable name (numpy, sklearn, PIL…). */
function packageForImport(pyodide, name) {
  if (!importToPackage) {
    importToPackage = new Map();
    for (const [packageName, details] of Object.entries(pyodide.lockfile?.packages || {})) {
      for (const importName of details.imports || []) importToPackage.set(importName, packageName);
    }
  }
  return importToPackage.get(name);
}

// Package names as Python normalises them: "Pillow" and "pillow" are one package.
const normalized = (name) => String(name).toLowerCase().replace(/[-_.]+/g, "-");

function isLoaded(pyodide, packageName) {
  const wanted = normalized(packageName);
  return Object.keys(pyodide.loadedPackages).some((name) => normalized(name) === wanted);
}

function importedRoots(pyodide, source) {
  let found;
  try {
    found = pyodide.pyimport("pyodide.code").find_imports(source);
    const names = found.toJs();
    return [...new Set(names.map((name) => String(name).split(".")[0]))];
  } catch {
    return []; // a syntax error: the run itself reports it
  } finally {
    found?.destroy?.();
  }
}

/**
 * Downloads the libraries the program imports, once each, before the 3-second
 * clock starts, then imports them so the learner's own `import` is instant.
 * This is pyodide.loadPackagesFromImports with one difference: names the
 * runner never allows (micropip, requests, pygame…) are left out, so they are
 * never downloaded.
 */
async function preparePackages(pyodide, source, report) {
  const roots = importedRoots(pyodide, source).filter((name) => !NEVER_LOADED_IMPORTS.has(name));
  // pandas draws with matplotlib (df.plot(), df.hist()) without importing it.
  if (roots.includes("pandas") && /\.(?:plot|hist|boxplot)\b/.test(source)) {
    roots.push("matplotlib");
  }
  const libraries = roots.filter((name) => packageForImport(pyodide, name));
  const missing = [
    ...new Set(libraries.map((name) => packageForImport(pyodide, name))),
  ].filter((packageName) => !isLoaded(pyodide, packageName));
  if (missing.length) {
    const names = libraries.filter((name) => missing.includes(packageForImport(pyodide, name)));
    report("loading", `Loading ${names.join(", ")}… (first time only)`);
    try {
      await pyodide.loadPackage(missing, {
        messageCallback: () => {},
        // For whoever opens the browser console; the learner gets one sentence.
        errorCallback: (text) => console.warn(text),
      });
    } catch (error) {
      console.warn(error);
      throw new Error(
        `${names.join(", ")} could not be downloaded. Check your internet connection and select Run Python again.`
      );
    }
    for (const packageName of missing) {
      if (!isLoaded(pyodide, packageName)) {
        throw new Error(
          `${names.join(", ")} could not be downloaded. Check your internet connection and select Run Python again.`
        );
      }
    }
  }
  if (libraries.length) {
    const toImport = [...libraries];
    if (toImport.includes("matplotlib")) toImport.push("matplotlib.pyplot", "matplotlib.animation");
    const runtime = pyodide.pyimport("_educlub_runtime");
    const names = pyodide.toPy(toImport);
    try {
      runtime.preimport(names);
    } finally {
      names.destroy();
      runtime.destroy();
    }
  }
}

function finishPictures(pyodide, report) {
  const runtime = pyodide.pyimport("_educlub_runtime");
  try {
    // Drawing has its own time limit; it starts once the program has ended.
    if (runtime.needs_drawing()) report("drawing");
    return JSON.parse(runtime.finish());
  } catch {
    return { images: [], notes: ["Your charts could not be drawn."] };
  } finally {
    runtime.destroy();
  }
}

async function runPython({ code, inputs = [], seed, page, clicked }, report) {
  const original = String(code || "");
  if (!original.trim()) throw new Error("Add some Python code before selecting Run Python.");
  if (original.length > PYTHON_MAX_SOURCE_LENGTH) {
    throw new Error(
      `Python code is limited to ${PYTHON_MAX_SOURCE_LENGTH.toLocaleString()} characters.`
    );
  }
  // `pip install x` lines are blanked with a kind note, not a SyntaxError.
  const { code: source, notices } = withoutInstallLines(original);
  if (!source.trim()) {
    report("running");
    return { stdout: "", stderr: "", result: "", notices, images: [] };
  }

  const pyodide = await initializePyodide();
  await preparePackages(pyodide, source, report);
  const runtime = pyodide.pyimport("_educlub_runtime");
  runtime.begin();
  runtime.destroy();
  report("running");

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

  // Charts shown before an error or a question stay on screen too.
  const pictures = finishPictures(pyodide, report);
  const extras = { notices: [...notices, ...pictures.notes], images: pictures.images };
  if (terminal?.awaitingInput) {
    // Waiting for an answer is not an error, even though Python saw EOFError.
    return { stdout: terminal.text, stderr, result: "", awaitingInput: true, ...extras };
  }
  if (failure) {
    // What the program printed before the error stays on screen above it.
    failure.stdout = terminal ? terminal.text : stdout;
    failure.extras = extras;
    throw failure;
  }
  return { stdout: terminal ? terminal.text : stdout, stderr, result: displayResult, ...extras };
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (!isPythonRunnerMessage(message) || message.type !== "run") return;
  const startedAt = performance.now();
  const report = (phase, text = "") =>
    self.postMessage(pythonRunnerMessage("phase", { id: message.id, phase, text }));
  try {
    const output = await runPython(message, report);
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
        ...(error?.extras || {}),
        // Pyodide's own frames sit above the learner's; strip them so the
        // message a beginner reads starts at their own code. Imports that
        // cannot work in a browser get one plain sentence instead.
        error: boundedPythonText(
          friendlyPythonError(error?.message) || "Python could not run this program."
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
