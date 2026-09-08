import {
  boundedPythonText,
  isPythonRunnerMessage,
  PYTHON_EXECUTION_TIMEOUT_MS,
  PYTHON_MAX_SOURCE_LENGTH,
  pythonRunnerMessage,
} from "./protocol";

const statusNode = document.querySelector("[data-python-runner-status]");
const configuredParents = Array.isArray(globalThis.__EDUCLUB_PYTHON_PARENT_ORIGINS__)
  ? globalThis.__EDUCLUB_PYTHON_PARENT_ORIGINS__
  : [];
const allowedParentOrigins = new Set(configuredParents);
const requestedParentOrigin = new URLSearchParams(window.location.search).get("parentOrigin") || "";
const parentOrigin = allowedParentOrigins.has(requestedParentOrigin) ? requestedParentOrigin : "";

let worker;
let activeRun;

function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

function postToParent(type, payload = {}) {
  if (!parentOrigin || window.parent === window) return;
  window.parent.postMessage(pythonRunnerMessage(type, payload), parentOrigin);
}

function startWorker() {
  worker?.terminate();
  worker = new Worker(new URL("./python.worker.mjs", import.meta.url), { type: "module" });
  setStatus("Preparing the secure Python workspace…");

  worker.addEventListener("message", (event) => {
    const message = event.data;
    if (!isPythonRunnerMessage(message)) return;
    if (message.type === "ready") {
      setStatus("Python workspace ready.");
      postToParent("ready");
      return;
    }
    if (message.type === "startup_error") {
      setStatus("Python could not start.");
      postToParent("startup_error", { error: boundedPythonText(message.error) });
      return;
    }
    if (message.type !== "result" || !activeRun || message.id !== activeRun.id) return;
    clearTimeout(activeRun.timer);
    const resolve = activeRun.resolve;
    activeRun = null;
    setStatus("Python workspace ready.");
    resolve(message);
  });

  worker.addEventListener("error", () => {
    if (activeRun) {
      clearTimeout(activeRun.timer);
      const resolve = activeRun.resolve;
      const id = activeRun.id;
      activeRun = null;
      resolve(
        pythonRunnerMessage("result", {
          id,
          ok: false,
          error: "The isolated Python worker stopped unexpectedly.",
        })
      );
    }
    setStatus("Restarting the Python workspace…");
    startWorker();
  });
}

function executePython({ id, code, inputs = [] }) {
  if (activeRun) {
    return Promise.resolve(
      pythonRunnerMessage("result", {
        id,
        ok: false,
        error: "Another Python program is still running.",
      })
    );
  }
  if (String(code || "").length > PYTHON_MAX_SOURCE_LENGTH) {
    return Promise.resolve(
      pythonRunnerMessage("result", {
        id,
        ok: false,
        error: `Python code is limited to ${PYTHON_MAX_SOURCE_LENGTH.toLocaleString()} characters.`,
      })
    );
  }

  setStatus("Running Python safely…");
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      if (!activeRun || activeRun.id !== id) return;
      activeRun = null;
      resolve(
        pythonRunnerMessage("result", {
          id,
          ok: false,
          error: "This program ran for too long and was stopped after 3 seconds.",
          timedOut: true,
        })
      );
      startWorker();
    }, PYTHON_EXECUTION_TIMEOUT_MS);
    activeRun = { id, resolve, timer };
    worker.postMessage(pythonRunnerMessage("run", { id, code, inputs }));
  });
}

function cancelActiveRun() {
  if (!activeRun) return null;
  clearTimeout(activeRun.timer);
  const resolve = activeRun.resolve;
  const id = activeRun.id;
  activeRun = null;
  const result = pythonRunnerMessage("result", {
    id,
    ok: false,
    error: "Python execution was cancelled.",
    cancelled: true,
  });
  resolve(result);
  startWorker();
  return result;
}

window.addEventListener("message", async (event) => {
  if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
  const message = event.data;
  if (!isPythonRunnerMessage(message)) return;
  if (message.type === "cancel") {
    const result = cancelActiveRun();
    if (result) postToParent("result", result);
    return;
  }
  if (message.type !== "run") return;
  const result = await executePython(message);
  postToParent("result", result);
});

startWorker();

// A local-only hook lets browser verification exercise the real WASM runtime
// without exposing a production debugging API.
if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  globalThis.__educlubPythonRun = (code, inputs = []) =>
    executePython({ id: `debug-${Date.now()}`, code, inputs });
}
