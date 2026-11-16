const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { errorHandler } = require("../src/middleware/error.middleware");

async function post(body) {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/upload", (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return { status: response.status, payload: await response.json() };
  } finally {
    server.close();
  }
}

test("an upload over the size limit says so instead of reporting a server fault", async () => {
  const { status, payload } = await post(JSON.stringify({ dataUrl: "A".repeat(4096) }));
  assert.equal(status, 413);
  assert.match(payload.error, /too large/);
});

test("a body that is not JSON is the caller's mistake, not a server fault", async () => {
  const { status, payload } = await post("{not json");
  assert.equal(status, 400);
  assert.match(payload.error, /could not be read/);
});
