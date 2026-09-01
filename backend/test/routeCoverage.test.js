const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROUTES_DIR = path.join(__dirname, "../src/routes");
const FRONTEND_SRC = path.join(__dirname, "../../frontend/src");

// server.js mounts each router under a prefix; the frontend's apiClient already
// carries the /api base, so these prefixes are what its call paths resolve
// against.
function mountPrefixes() {
  const server = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");
  const prefixes = new Map();
  for (const [, prefix, variable] of server.matchAll(
    /app\.use\("\/api\/([\w-]+)",\s*(\w+Routes)\)/g,
  )) {
    prefixes.set(variable, prefix);
  }
  return prefixes;
}

function routerVariableFor(file) {
  const base = path.basename(file, ".routes.js");
  return `${base}Routes`;
}

function mountedRoutes() {
  const prefixes = mountPrefixes();
  const mounted = [];

  for (const file of fs.readdirSync(ROUTES_DIR)) {
    const router = require(path.join(ROUTES_DIR, file));
    const prefix = prefixes.get(routerVariableFor(file));
    assert.ok(prefix, `${file} is not mounted in server.js`);

    for (const layer of router.stack || []) {
      if (!layer.route) continue;

      // A middleware that resolved to undefined - a deleted or renamed export -
      // makes Express throw at mount time, so catch it here instead.
      for (const handler of layer.route.stack) {
        assert.equal(
          typeof handler.handle,
          "function",
          `${file} ${layer.route.path} has a handler that is not a function`,
        );
      }

      mounted.push({
        methods: Object.keys(layer.route.methods).map((m) => m.toUpperCase()),
        segments: `${prefix}${layer.route.path}`.split("/").filter(Boolean),
      });
    }
  }
  return mounted;
}

function frontendApiCalls() {
  const calls = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|build/.test(full)) walk(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const source = fs.readFileSync(full, "utf8");
      for (const [, method, url] of source.matchAll(
        /apiClient\.(get|post|put|delete)\(\s*[`'"]([^`'"]+)/g,
      )) {
        calls.push({
          file: path.relative(FRONTEND_SRC, full),
          method: method.toUpperCase(),
          // Template holes and query strings are not part of path matching.
          segments: url
            .split("?")[0]
            .replace(/\$\{[^}]*\}/g, ":param")
            .split("/")
            .filter(Boolean),
        });
      }
    }
  };
  walk(FRONTEND_SRC);
  return calls;
}

test("every router is mounted and every handler resolves", () => {
  const mounted = mountedRoutes();
  assert.ok(mounted.length > 150, `only ${mounted.length} routes mounted`);
});

test("every frontend API call resolves to a mounted route", () => {
  const mounted = mountedRoutes();
  const unresolved = [];

  for (const call of frontendApiCalls()) {
    const found = mounted.some(
      (route) =>
        route.methods.includes(call.method) &&
        route.segments.length === call.segments.length &&
        route.segments.every(
          (segment, index) =>
            segment.startsWith(":") ||
            call.segments[index] === ":param" ||
            segment === call.segments[index],
        ),
    );
    if (!found) unresolved.push(`${call.method} ${call.segments.join("/")} (${call.file})`);
  }

  assert.deepEqual(unresolved, [], `frontend calls with no backend route:\n${unresolved.join("\n")}`);
});
