import {
  boundedPythonText,
  isPythonRunnerMessage,
  PYTHON_STARTUP_TIMEOUT_MS,
  pythonRunnerMessage,
  sanitizeClicked,
  sanitizeNotices,
  sanitizePageFields,
  sanitizePythonImages,
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
    if (message.type === "status") {
      // "Loading numpy… (first time only)" while a library downloads.
      const request = pending.get(message.id);
      if (request?.onStatus && typeof message.text === "string") {
        request.onStatus(boundedPythonText(message.text, 200));
      }
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

/**
 * What the output box shows. Notes (a skipped `pip install` line, a chart that
 * was cut short) come first. A program waiting at input() shows exactly what
 * it printed so far, so the answer box sits right after the question.
 */
export function formatPythonResult(message) {
  const notices = sanitizeNotices(message.notices);
  const noticeText = notices.length ? `${notices.join("\n")}\n\n` : "";
  if (message.awaitingInput) return boundedPythonText(`${noticeText}${message.stdout || ""}`);
  const program = [message.stdout, message.stderr, message.result, message.error]
    .filter(Boolean)
    .join("\n");
  if (!program && !noticeText) {
    // A program that only draws a chart has the chart to show for itself.
    return sanitizePythonImages(message.images).length ? "" : "Program finished with no output.";
  }
  return boundedPythonText(`${noticeText}${program}`.trimEnd());
}

/**
 * Runs a program once. A plain program stops at the first input() with no
 * answer in `inputs` and comes back with `awaitingInput: true`; the caller asks
 * the learner, then runs it again with that answer added (and the same `seed`).
 */
export async function runPythonInBrowser(
  code,
  { inputs = [], seed, page, clicked, onStatus } = {}
) {
  const activeRunner = getRunner();
  onStatus?.("Preparing Python—this first load happens only once…");
  await activeRunner.ready;
  onStatus?.("Running Python safely…");
  const id = `python-${Date.now()}-${nextRequestId++}`;
  const resultPromise = new Promise((resolve) =>
    activeRunner.pending.set(id, { resolve, onStatus })
  );
  const payload = { id, code: String(code || ""), inputs, seed };
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
  return {
    ...result,
    images: sanitizePythonImages(result.images),
    output: formatPythonResult(result),
  };
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
