const fs = require("node:fs");
const path = require("node:path");

const { learnerFacingError } = require("../python-runner/protocol");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", "..", relativePath), "utf8");
}

describe("Python runner security and performance boundaries", () => {
  test("the Vercel runner document has a deny-by-default CSP", () => {
    const config = JSON.parse(read("vercel.json"));
    const runnerHeaders = config.headers.find((entry) => entry.source === "/python-runner.html");
    const csp = runnerHeaders.headers.find(
      (header) => header.key === "Content-Security-Policy"
    ).value;

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("connect-src https://cdn.jsdelivr.net");
    expect(csp).not.toContain("learn.educlub.co.ke");
  });

  test("Pyodide is imported only by the isolated worker", () => {
    expect(read("src/python-runner/python.worker.mjs")).toContain('from "pyodide"');
    expect(read("src/lib/pythonRunnerClient.js")).not.toMatch(/from ["']pyodide["']/);
    expect(read("src/layouts/learner/module-learn/index.js")).not.toMatch(/from ["']pyodide["']/);
  });

  test("the worker restricts JavaScript bridges and package/network imports", () => {
    const worker = read("src/python-runner/python.worker.mjs");
    expect(worker).toContain("jsglobals: safeJavaScriptGlobals");
    expect(worker).toContain('"js"');
    expect(worker).toContain('"micropip"');
    expect(worker).toContain('"pyodide.http"');
    expect(worker).not.toContain("loadPackagesFromImports");
  });

  test("the worker shows learners their own frames, not Pyodide's", () => {
    expect(read("src/python-runner/python.worker.mjs")).toContain(
      "learnerFacingError(error?.message)"
    );
  });

  test("learnerFacingError keeps everything from the learner's first frame down", () => {
    const raw = [
      "Traceback (most recent call last):",
      '  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async',
      "    await CodeRunner(",
      "    ...<9 lines>...",
      "    .run_async(globals, locals)",
      '  File "/lib/python314.zip/_pyodide/_base.py", line 411, in run_async',
      "    coroutine = eval(self.code, globals, locals)",
      '  File "learner.py", line 2, in <module>',
      "    print(scoree)",
      "          ^^^^^^",
      "NameError: name 'scoree' is not defined",
    ].join("\n");

    const trimmed = learnerFacingError(raw);

    expect(trimmed).not.toContain("_base.py");
    expect(trimmed).toContain("Traceback (most recent call last):");
    expect(trimmed).toContain('File "learner.py", line 2');
    expect(trimmed).toContain("NameError: name 'scoree' is not defined");
    // The caret line that points at the mistake must survive.
    expect(trimmed).toContain("^^^^^^");
  });

  test("learnerFacingError never empties or rewrites an unexpected message", () => {
    const noLearnerFrame = [
      "Traceback (most recent call last):",
      '  File "/lib/x.py", line 1',
      "RuntimeError: boom",
    ].join("\n");
    expect(learnerFacingError(noLearnerFrame)).toBe(noLearnerFrame);

    const plain = "This program ran for too long and was stopped after 3 seconds.";
    expect(learnerFacingError(plain)).toBe(plain);

    expect(learnerFacingError("")).toBe("");
    expect(learnerFacingError(undefined)).toBe("");
  });

  test("the runner is a separate Vite entry and production uses its isolated origin", () => {
    const vite = read("vite.config.mjs");
    expect(vite).toContain('"python-runner": path.resolve(process.cwd(), "python-runner.html")');
    expect(vite).toContain("https://runner.educlub.co.ke/python-runner.html");
  });
});
