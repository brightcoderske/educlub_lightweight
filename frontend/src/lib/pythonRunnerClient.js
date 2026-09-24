import {
  boundedPythonText,
  isPythonRunnerMessage,
  PYTHON_STARTUP_TIMEOUT_MS,
  pythonRunnerMessage,
  sanitizeClicked,
  sanitizePageFields,
} from "../python-runner/protocol";

let runner;
let nextRequestId = 1;

function configuredRunnerUrl() {
  const configured = String(globalThis.__EDUCLUB_PYTHON_RUNNER_URL__ || "").trim();
  return new URL(configured || "/python-runner.html", window.location.origin);
}

function createRunner() {
  const url = configuredRunnerUrl();
  url.searchParams.set("parentOrigin", window.location.origin);
  const iframe = document.createElement("iframe");
  iframe.title = "Secure Python runner";
  iframe.hidden = true;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.referrerPolicy = "strict-origin";
  iframe.src = url.toString();
  document.body.appendChild(iframe);

  const pending = new Map();
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const startupTimer = window.setTimeout(() => {
    readyReject(
      new Error("The Python workspace took too long to start. Check your connection and try again.")
    );
  }, PYTHON_STARTUP_TIMEOUT_MS);

  const onMessage = (event) => {
    if (event.origin !== url.origin || event.source !== iframe.contentWindow) return;
    const message = event.data;
    if (!isPythonRunnerMessage(message)) return;
    if (message.type === "ready") {
      clearTimeout(startupTimer);
      readyResolve();
      return;
    }
    if (message.type === "startup_error") {
      clearTimeout(startupTimer);
      readyReject(new Error(boundedPythonText(message.error)));
      return;
    }
    if (message.type !== "result") return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    request.resolve(message);
  };
  window.addEventListener("message", onMessage);

  return {
    iframe,
    origin: url.origin,
    pending,
    ready,
    destroy() {
      clearTimeout(startupTimer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      for (const request of pending.values()) {
        request.resolve({ ok: false, error: "Python execution was cancelled.", cancelled: true });
      }
      pending.clear();
    },
  };
}

function getRunner() {
  if (!runner) runner = createRunner();
  return runner;
}

export function formatPythonResult(message) {
  const sections = [];
  if (message.stdout) sections.push(message.stdout);
  if (message.stderr) sections.push(message.stderr);
  if (message.result) sections.push(message.result);
  if (message.error) sections.push(message.error);
  return boundedPythonText(
    sections.filter(Boolean).join("\n") || "Program finished with no output."
  );
}

export async function runPythonInBrowser(code, { inputs = [], page, clicked, onStatus } = {}) {
  const activeRunner = getRunner();
  onStatus?.("Preparing Python—this first load happens only once…");
  await activeRunner.ready;
  onStatus?.("Running Python safely…");
  const id = `python-${Date.now()}-${nextRequestId++}`;
  const resultPromise = new Promise((resolve) => activeRunner.pending.set(id, { resolve }));
  const payload = { id, code: String(code || ""), inputs };
  // Only Python + HTML runs carry page fields; plain Python runs stay unchanged.
  if (page !== undefined) {
    payload.page = Object.fromEntries(sanitizePageFields(page));
    payload.clicked = sanitizeClicked(clicked);
  }
  activeRunner.iframe.contentWindow.postMessage(
    pythonRunnerMessage("run", payload),
    activeRunner.origin
  );
  const result = await resultPromise;
  return { ...result, output: formatPythonResult(result) };
}

export function cancelPythonExecution() {
  if (!runner) return;
  runner.iframe.contentWindow.postMessage(pythonRunnerMessage("cancel"), runner.origin);
  for (const request of runner.pending.values()) {
    request.resolve({ ok: false, error: "Python execution was cancelled.", cancelled: true });
  }
  runner.pending.clear();
}

export function disposePythonRunner() {
  runner?.destroy();
  runner = null;
}
