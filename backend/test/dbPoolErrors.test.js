const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { attachPoolErrorHandler } = require("../src/config/poolErrors");

test("idle database connection errors are logged without crashing the process", () => {
  const pool = new EventEmitter();
  const logged = [];

  attachPoolErrorHandler(pool, {
    error(message, error) {
      logged.push({ message, error });
    },
  });

  const connectionError = new Error("Connection terminated unexpectedly");
  assert.doesNotThrow(() => pool.emit("error", connectionError));
  assert.equal(logged.length, 1);
  assert.equal(logged[0].message, "Unexpected idle database connection error");
  assert.equal(logged[0].error, connectionError);
});
