const test = require("node:test");
const assert = require("node:assert/strict");
const settings = require("../src/services/aiSettings.service");
const controller = require("../src/controllers/ai.controller");

test("AI database failures reach Express error handling without crashing the API", async (t) => {
  for (const [handler, method] of [["getSettings", "getAiSettings"],
    ["updateSettings", "updateAiSettings"], ["getAvailability", "getAiAvailability"]]) {
    const failure = new Error("Database unavailable");
    t.mock.method(settings, method, async () => { throw failure; });
    let forwarded;
    await controller[handler]({ user: {}, body: {} }, {
      json() { assert.fail("A failed query must not send a success response"); },
    }, (error) => { forwarded = error; });
    assert.equal(forwarded, failure);
  }
});
