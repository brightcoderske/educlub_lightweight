const fs = require("node:fs");
const path = require("node:path");

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

  test("the runner is a separate Vite entry and production uses its isolated origin", () => {
    const vite = read("vite.config.mjs");
    expect(vite).toContain('"python-runner": path.resolve(process.cwd(), "python-runner.html")');
    expect(vite).toContain("https://runner.educlub.co.ke/python-runner.html");
  });
});
