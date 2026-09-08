export const PYTHON_RUNNER_CHANNEL = "educlub-python-runner/v1";
export const PYTHON_MAX_SOURCE_LENGTH = 20_000;
export const PYTHON_MAX_OUTPUT_LENGTH = 20_000;
export const PYTHON_EXECUTION_TIMEOUT_MS = 3_000;
export const PYTHON_STARTUP_TIMEOUT_MS = 45_000;

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
