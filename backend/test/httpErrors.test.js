const test = require("node:test");
const assert = require("node:assert/strict");

const { respondWithError } = require("../src/utils/httpErrors");
const { fakeResponse } = require("./fakeResponse");

test("an error raised on purpose reaches the caller with its own status and message", (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const res = fakeResponse();

  respondWithError(
    res,
    Object.assign(new Error("Your school's eduClub access is paused."), { statusCode: 403 }),
    "Something went wrong",
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Your school's eduClub access is paused." });
  assert.equal(logged.mock.callCount(), 0, "an expected failure is not a fault to log");
});

test("anything unexpected is logged in full and answered with the fallback only", (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const res = fakeResponse();
  const boom = new Error("connect ECONNREFUSED 127.0.0.1:3306");

  respondWithError(res, boom, "Failed to load invoices");

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Failed to load invoices" });
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(logged.mock.calls[0].arguments, ["Failed to load invoices", boom]);
});
