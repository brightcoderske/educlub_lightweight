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

export function boundedPythonText(value, maximum = PYTHON_MAX_OUTPUT_LENGTH) {
  const text = String(value ?? "");
  if (text.length <= maximum) return text;
  return `${text.slice(
    0,
    maximum
  )}\n\n[Output stopped after ${maximum.toLocaleString()} characters.]`;
}
