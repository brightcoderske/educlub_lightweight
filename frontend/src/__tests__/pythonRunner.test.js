import {
  boundedPythonText,
  isPythonRunnerMessage,
  PYTHON_MAX_OUTPUT_LENGTH,
  pythonRunnerMessage,
} from "../python-runner/protocol";
import {
  disposePythonRunner,
  formatPythonResult,
  runPythonInBrowser,
} from "../lib/pythonRunnerClient";

function dispatchRunnerMessage(iframe, origin, data) {
  const event = new window.MessageEvent("message", { data, origin });
  Object.defineProperty(event, "source", { value: iframe.contentWindow, configurable: true });
  window.dispatchEvent(event);
}

describe("Python runner protocol", () => {
  afterEach(() => {
    disposePythonRunner();
    document.body.innerHTML = "";
    delete globalThis.__EDUCLUB_PYTHON_RUNNER_URL__;
  });

  test("protocol messages cannot have their channel or type replaced by payload data", () => {
    const message = pythonRunnerMessage("ready", { channel: "wrong", type: "wrong" });
    expect(message.type).toBe("ready");
    expect(isPythonRunnerMessage(message)).toBe(true);
  });

  test("long output is bounded and visibly marked", () => {
    const output = boundedPythonText("x".repeat(PYTHON_MAX_OUTPUT_LENGTH + 100));
    expect(output.length).toBeLessThan(PYTHON_MAX_OUTPUT_LENGTH + 100);
    expect(output).toContain("Output stopped");
  });

  test("stdout, stderr and expression results are formatted as plain text", () => {
    expect(formatPythonResult({ stdout: "hello", stderr: "warning", result: "42" })).toBe(
      "hello\nwarning\n42"
    );
    expect(formatPythonResult({})).toBe("Program finished with no output.");
  });

  test("creates the isolated iframe lazily and accepts messages only from its exact origin", async () => {
    const runPromise = runPythonInBrowser("print('hello')");
    const iframe = document.querySelector('iframe[title="Secure Python runner"]');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    const runnerOrigin = new URL(iframe.src).origin;
    const postMessage = jest.fn();
    iframe.contentWindow.postMessage = postMessage;

    dispatchRunnerMessage(iframe, "https://attacker.example", pythonRunnerMessage("ready"));
    await Promise.resolve();
    expect(postMessage).not.toHaveBeenCalled();

    dispatchRunnerMessage(iframe, runnerOrigin, pythonRunnerMessage("ready"));
    await Promise.resolve();
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledTimes(1);
    const [request, targetOrigin] = postMessage.mock.calls[0];
    expect(request.type).toBe("run");
    expect(request.code).toBe("print('hello')");
    expect(targetOrigin).toBe(runnerOrigin);

    dispatchRunnerMessage(
      iframe,
      runnerOrigin,
      pythonRunnerMessage("result", { id: request.id, ok: true, stdout: "hello" })
    );
    await expect(runPromise).resolves.toMatchObject({ ok: true, output: "hello" });
  });
});
