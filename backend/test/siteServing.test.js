const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const { frontendSite, forApiOnly, isApiRequest } = require("../src/site");

// A miniature build: the app page, one search-engine page and one hashed script.
function makeBuild() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "educlub-site-"));
  fs.writeFileSync(path.join(root, "index.html"), "<title>app</title>");
  fs.mkdirSync(path.join(root, "login"));
  fs.writeFileSync(path.join(root, "login", "index.html"), "<title>login page</title>");
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app-abc123.js"), "console.log(1)");
  fs.writeFileSync(path.join(path.dirname(root), "secret.env"), "NOT FOR THE WEB");
  return root;
}

async function serve(t) {
  const root = makeBuild();
  const app = express();
  app.use(forApiOnly((req, res, next) => { res.setHeader("X-Api-Policy", "strict"); next(); }));
  app.get("/api/ping", (req, res) => res.json({ pong: true }));
  app.use(frontendSite(root));
  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (url) => {
    const response = await fetch(base + url);
    return { status: response.status, headers: response.headers, body: await response.text() };
  };
}

test("app addresses get the app page, public pages their own page", async (t) => {
  const get = await serve(t);
  assert.match((await get("/learner/courses")).body, /<title>app<\/title>/);
  assert.match((await get("/login")).body, /login page/);
  assert.match((await get("/login/")).body, /login page/);
});

test("hashed scripts are cached for a year, pages are always revalidated", async (t) => {
  const get = await serve(t);
  assert.match((await get("/assets/app-abc123.js")).headers.get("cache-control"), /immutable/);
  assert.equal((await get("/learner")).headers.get("cache-control"), "no-cache");
});

test("a missing file is a 404, not the app page", async (t) => {
  const get = await serve(t);
  const missing = await get("/assets/app-gone.js");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.body, /<title>/);
});

test("the API keeps its own answers and headers; the site does not get the API policy", async (t) => {
  const get = await serve(t);
  const api = await get("/api/ping");
  assert.deepEqual(JSON.parse(api.body), { pong: true });
  assert.equal(api.headers.get("x-api-policy"), "strict");
  assert.equal((await get("/api/unknown")).status, 404);
  assert.equal((await get("/learner")).headers.get("x-api-policy"), null);
});

test("nothing outside the build can be reached", async (t) => {
  const get = await serve(t);
  for (const url of ["/../secret.env", "/%2e%2e/secret.env", "/..%2fsecret.env"]) {
    assert.doesNotMatch((await get(url)).body, /NOT FOR THE WEB/, url);
  }
});

test("API paths are recognised exactly", () => {
  assert.equal(isApiRequest({ path: "/api/auth/login" }), true);
  assert.equal(isApiRequest({ path: "/health" }), true);
  assert.equal(isApiRequest({ path: "/uploads/school-logos/a.png" }), true);
  assert.equal(isApiRequest({ path: "/apiary" }), false);
  assert.equal(isApiRequest({ path: "/learner/uploads" }), false);
});
