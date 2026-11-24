import {
  boundedPythonText,
  isPythonRunnerMessage,
  nextRunPhase,
  PYTHON_MAX_SOURCE_LENGTH,
  pythonRunnerMessage,
  runPhaseTimeout,
  runPhaseTimeoutMessage,
} from "./protocol";

const statusNode = document.querySelector("[data-python-runner-status]");
const configuredParents = Array.isArray(globalThis.__EDUCLUB_PYTHON_PARENT_ORIGINS__)
  ? globalThis.__EDUCLUB_PYTHON_PARENT_ORIGINS__
  : [];
const allowedParentOrigins = new Set(configuredParents);
const requestedParentOrigin = new URLSearchParams(window.location.search).get("parentOrigin") || "";
const parentOrigin = allowedParentOrigins.has(requestedParentOrigin) ? requestedParentOrigin : "";

let worker;
let workerReady;
let markWorkerReady = () => {};
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
  // A run is only sent once Python has started, so a restart after a timeout
  // never eats into the next program's 3 seconds.
  // A run still waiting on the worker being replaced moves on to the new one.
  markWorkerReady("");
  let markReady;
  workerReady = new Promise((resolve) => (markReady = resolve));
  markWorkerReady = markReady;

  worker.addEventListener("message", (event) => {
    const message = event.data;
    if (!isPythonRunnerMessage(message)) return;
    if (message.type === "ready") {
      markReady("");
      setStatus("Python workspace ready.");
      postToParent("ready");
      return;
    }
    if (message.type === "startup_error") {
      markReady(boundedPythonText(message.error) || "Python could not start.");
      setStatus("Python could not start.");
      postToParent("startup_error", { error: boundedPythonText(message.error) });
      return;
    }
    if (!activeRun || message.id !== activeRun.id) return;
    if (message.type === "phase") {
      enterPhase(activeRun, message.phase, message.text);
      return;
    }
    if (message.type !== "result") return;
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

function executePython({ id, code, inputs = [], seed, page, clicked }, onStatus) {
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
    const run = { id, resolve, phase: "start", timer: null, onStatus };
    activeRun = run;
    sendWhenReady(run, { id, code, inputs, seed, page, clicked });
  });
}

async function sendWhenReady(run, { id, code, inputs, seed, page, clicked }) {
  let startupError;
  let waitedFor;
  do {
    waitedFor = workerReady;
    startupError = await waitedFor;
  } while (waitedFor !== workerReady);
  if (activeRun !== run) return; // cancelled while Python was starting
  if (startupError) {
    activeRun = null;
    run.resolve(pythonRunnerMessage("result", { id, ok: false, error: startupError }));
    return;
  }
  armTimer(run);
  const payload = { id, code, inputs, seed };
  // Python + HTML pages send their field values; the worker sanitizes them again.
  if (page !== undefined) {
    payload.page = page;
    payload.clicked = clicked;
  }
  worker.postMessage(pythonRunnerMessage("run", payload));
}

// Each phase of a run has its own clock: downloading libraries the first time
// does not count against the learner's 3 seconds, and neither does drawing
// their charts. Phases only move forward, so a run cannot reset its clock.
function armTimer(run) {
  clearTimeout(run.timer);
  run.timer = window.setTimeout(() => {
    if (activeRun !== run) return;
    activeRun = null;
    run.resolve(
      pythonRunnerMessage("result", {
        id: run.id,
        ok: false,
        error: runPhaseTimeoutMessage(run.phase),
        timedOut: true,
      })
    );
    startWorker();
  }, runPhaseTimeout(run.phase));
}

function enterPhase(run, requested, text) {
  const phase = nextRunPhase(run.phase, requested);
  if (!phase) return;
  run.phase = phase;
  armTimer(run);
  if (phase === "loading" && text) {
    const status = boundedPythonText(text, 200);
    setStatus(status);
    run.onStatus?.(status);
  }
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
  const result = await executePython(message, (text) =>
    postToParent("status", { id: message.id, text })
  );
  postToParent("result", result);
});

startWorker();

// A local-only hook lets browser verification exercise the real WASM runtime
// without exposing a production debugging API.
if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  globalThis.__educlubPythonRun = (code, inputs = [], seed) =>
    executePython({ id: `debug-${Date.now()}`, code, inputs, seed }, (text) =>
      console.info(text)
    );
}
