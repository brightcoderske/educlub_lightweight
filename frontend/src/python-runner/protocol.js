export const PYTHON_RUNNER_CHANNEL = "educlub-python-runner/v1";
export const PYTHON_MAX_SOURCE_LENGTH = 20_000;
export const PYTHON_MAX_OUTPUT_LENGTH = 20_000;
export const PYTHON_EXECUTION_TIMEOUT_MS = 3_000;
// Downloading a library (numpy, pandas, matplotlib…) the first time is not the
// learner's program running, so it has a budget of its own.
export const PYTHON_PACKAGE_TIMEOUT_MS = 90_000;
// Turning charts and animations into pictures after the program has finished.
export const PYTHON_DRAWING_TIMEOUT_MS = 15_000;
export const PYTHON_STARTUP_TIMEOUT_MS = 45_000;

export const PYTHON_PAGE_MAX_FIELDS = 50;
export const PYTHON_PAGE_MAX_NAME_LENGTH = 60;
export const PYTHON_PAGE_MAX_VALUE_LENGTH = 2_000;

/**
 * The field values a Python + HTML page hands to Python as `page`.
 *
 * They arrive from a sandboxed learner page, so nothing about their shape is
 * trusted: only string-keyed text survives, bounded in count and length.
 * Returns plain [name, value] pairs so each side can build whatever container
 * it needs (a Python dict, in the worker).
 */
export function sanitizePageFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  const pairs = [];
  for (const [name, value] of Object.entries(fields)) {
    if (pairs.length >= PYTHON_PAGE_MAX_FIELDS) break;
    const key = String(name).slice(0, PYTHON_PAGE_MAX_NAME_LENGTH);
    if (!key || (value !== null && typeof value === "object")) continue;
    pairs.push([key, String(value ?? "").slice(0, PYTHON_PAGE_MAX_VALUE_LENGTH)]);
  }
  return pairs;
}

/** Which button ran the program: its id, name or label, as short text. */
export function sanitizeClicked(value) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).slice(0, PYTHON_PAGE_MAX_NAME_LENGTH);
}

/**
 * The console a plain Python program talks to, so `input()` works like a real
 * terminal: the program stops at the first question nobody has answered yet,
 * the learner types the answer, and the program is run again from the top with
 * every answer so far. Answers are echoed after their prompt, as a terminal
 * would show them.
 *
 * Once the program is waiting, anything it prints afterwards is ignored - so a
 * program that catches the EOFError still shows exactly what it printed up to
 * the question, and nothing it did after.
 */
export function createPythonConsole(answers = []) {
  const queue = Array.isArray(answers) ? answers.map((answer) => String(answer)) : [];
  let text = "";
  let awaitingInput = false;
  return {
    write(chunk) {
      if (!awaitingInput) text = boundedPythonText(text + chunk);
    },
    /** The next answer, or null (end of input) once the program needs a new one. */
    readLine() {
      if (awaitingInput) return null;
      if (!queue.length) {
        awaitingInput = true;
        return null;
      }
      const answer = queue.shift();
      text = boundedPythonText(`${text}${answer}\n`);
      return answer;
    },
    get awaitingInput() {
      return awaitingInput;
    },
    get text() {
      return text;
    },
  };
}

/** A whole number seed for `random`, so a replayed program draws the same numbers. */
export function sanitizeSeed(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function pythonRunnerMessage(type, payload = {}) {
  return { ...payload, channel: PYTHON_RUNNER_CHANNEL, type };
}

export function isPythonRunnerMessage(value) {
  return Boolean(
    value && value.channel === PYTHON_RUNNER_CHANNEL && typeof value.type === "string"
  );
}

/**
 * The traceback a learner should actually read.
 *
 * Pyodide runs the learner's program from inside its own machinery, so every
 * traceback opens with six or seven frames from `/lib/python*.zip/_pyodide/`
 * before reaching anything the learner wrote. For a beginner that is a wall of
 * noise in front of the one line that matters, and it teaches them that
 * tracebacks are unreadable - the opposite of what a Python course needs.
 *
 * So the frames above the learner's first own frame are dropped. The header,
 * every frame in `learner.py`, and the whole tail - including any chained
 * "During handling of the above exception" section - are kept exactly as Python
 * wrote them.
 *
 * This only ever REMOVES text that was already on its way to the screen, and
 * only when the learner's own file is there to anchor it. Anything with an
 * unexpected shape is passed through untouched, so a message can never be
 * silently emptied or altered.
 */
export function learnerFacingError(value) {
  const text = String(value ?? "");
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.includes('File "learner.py"'));
  if (first <= 0) return text;

  const header = /^Traceback \(most recent call last\):\s*$/.test(lines[0]) ? [lines[0]] : [];
  const kept = [...header, ...lines.slice(first)].join("\n");
  // Never hand back less than the line that names the error.
  return kept.trim() ? kept : text;
}

export function boundedPythonText(value, maximum = PYTHON_MAX_OUTPUT_LENGTH) {
  const text = String(value ?? "");
  if (text.length <= maximum) return text;
  return `${text.slice(
    0,
    maximum
  )}\n\n[Output stopped after ${maximum.toLocaleString()} characters.]`;
}

/**
 * A run moves forward through these phases, each with its own time limit:
 * "start" (checking the code), "loading" (downloading libraries the first
 * time), "running" (the learner's program: the 3-second limit), "drawing"
 * (turning charts into pictures). Returns the new phase, or null when the
 * request would go backwards or repeat - so a run can never restart its clock.
 */
const RUN_PHASES = ["start", "loading", "running", "drawing"];
export function nextRunPhase(current, requested) {
  const from = RUN_PHASES.indexOf(current);
  const to = RUN_PHASES.indexOf(requested);
  if (from < 0 || to <= from) return null;
  if (requested === "loading" && current !== "start") return null;
  return requested;
}

export function runPhaseTimeout(phase) {
  if (phase === "loading") return PYTHON_PACKAGE_TIMEOUT_MS;
  if (phase === "drawing") return PYTHON_DRAWING_TIMEOUT_MS;
  return PYTHON_EXECUTION_TIMEOUT_MS;
}

export function runPhaseTimeoutMessage(phase) {
  if (phase === "loading") {
    return "The Python libraries took too long to download. Check your internet connection and select Run Python again.";
  }
  if (phase === "drawing") {
    return "Drawing your charts took too long, so the program was stopped. Try a smaller chart or fewer animation frames.";
  }
  return "This program ran for too long and was stopped after 3 seconds.";
}

/**
 * Lines a learner copies from a tutorial that are not Python: `pip install x`,
 * `!pip install x`, `%pip install x`, `python -m pip install x`, `conda
 * install x` and notebook magics like `%matplotlib inline`. Libraries load by
 * themselves here, so these lines are blanked (keeping every other line number
 * the same) and the learner gets a kind note instead of a SyntaxError.
 */
const INSTALL_LINE =
  /^\s*[!%]?\s*(?:(?:python3?|py)\s+-m\s+)?(?:pip3?|conda|mamba)\s+install\b(.*)$/i;
const NOTEBOOK_MAGIC_LINE = /^\s*%(?:matplotlib|config|load_ext|time|timeit)\b.*$/;

export function withoutInstallLines(code) {
  const notices = [];
  const lines = String(code ?? "").split("\n");
  const kept = lines.map((line, index) => {
    const install = INSTALL_LINE.exec(line);
    if (install) {
      const names = install[1]
        .split(/\s+/)
        .filter((word) => word && !word.startsWith("-"))
        .map((word) => word.replace(/[<>=!~].*$/, ""))
        .filter(Boolean)
        .slice(0, 5);
      const loads =
        names.length === 1
          ? `${names[0]} loads by itself when you import it.`
          : `${names.length ? names.join(", ") : "Libraries"} load by themselves when you import them.`;
      notices.push(
        `Line ${index + 1}: nothing needs installing here, so "${line
          .trim()
          .slice(0, 80)}" was skipped. ${loads}`
      );
      return "";
    }
    if (NOTEBOOK_MAGIC_LINE.test(line)) {
      notices.push(
        `Line ${index + 1}: "${line
          .trim()
          .slice(0, 80)}" is a notebook command, so it was skipped. Charts show below your output by themselves.`
      );
      return "";
    }
    return line;
  });
  return { code: notices.length ? kept.join("\n") : String(code ?? ""), notices };
}

/**
 * Plain words instead of a traceback for the things the runner explains
 * itself: a library that cannot work inside a web page (the import guard marks
 * those with "[educlub]"), and a library that is not available at all.
 * Everything else is the trimmed traceback from learnerFacingError.
 */
export function friendlyPythonError(value) {
  const text = String(value ?? "");
  const lines = text.trimEnd().split("\n");
  // The import guard's own frame ("<exec>") does not count: the import the
  // learner wrote is the last frame that matters.
  const frames = lines.filter((line) => /^\s*File "/.test(line) && !line.includes('File "<exec>"'));
  const lastFrame = frames[frames.length - 1] || "";
  const learnerLine = /File "learner\.py", line (\d+)/.exec(lastFrame);
  const where = learnerLine ? `Line ${learnerLine[1]}: ` : "";
  // Pyodide adds its own lines (how to install with micropip…) after the
  // error line, so the error line is found by its shape, not its position.
  const errorLine = (pattern) => lines.map((line) => pattern.exec(line)).find(Boolean);

  const explained = errorLine(/^(?:ModuleNotFoundError|ImportError): \[educlub\] (.+)$/);
  if (explained) return `${where}${explained[1]}`;

  const missing = errorLine(/^ModuleNotFoundError: No module named '([\w.]+)'$/);
  if (missing && learnerLine) {
    return (
      `${where}there is no library called "${missing[1]}" here. Check the spelling. ` +
      "Libraries built for the browser, such as numpy, pandas, matplotlib, scipy, " +
      "scikit-learn and sympy, load by themselves when you import them; other " +
      "libraries cannot be added."
    );
  }
  return learnerFacingError(text);
}

export const PYTHON_MAX_IMAGES = 8;
export const PYTHON_MAX_IMAGE_LENGTH = 6_000_000;
const IMAGE_DATA_URL = /^data:image\/(?:png|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Charts and animations come back from the runner as data URLs of PNG or GIF
 * pictures - data only, never HTML. Anything else is dropped.
 */
export function sanitizePythonImages(value) {
  if (!Array.isArray(value)) return [];
  const images = [];
  for (const item of value) {
    if (images.length >= PYTHON_MAX_IMAGES) break;
    if (!item || typeof item !== "object") continue;
    const src = typeof item.src === "string" ? item.src : "";
    if (src.length > PYTHON_MAX_IMAGE_LENGTH || !IMAGE_DATA_URL.test(src)) continue;
    images.push({
      kind: item.kind === "animation" ? "animation" : "image",
      src,
      note: typeof item.note === "string" ? item.note.slice(0, 300) : "",
    });
  }
  return images;
}

/** Short notes shown above the output (skipped pip lines, cut-short charts). */
export function sanitizeNotices(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((notice) => typeof notice === "string" && notice)
    .slice(0, 10)
    .map((notice) => notice.slice(0, 400));
}
