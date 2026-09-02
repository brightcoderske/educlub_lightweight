const test = require("node:test");
const assert = require("node:assert/strict");
const { typeCast } = require("../src/config/mysqlTypes");

test("database booleans retain true, false and null rather than numeric flags", () => {
  for (const [stored, expected] of [["1", true], ["0", false], [null, null]]) {
    assert.equal(typeCast({ type: "TINY", length: 1, string: () => stored }, () => {
      throw new Error("Boolean decoding was skipped");
    }), expected);
  }
});

test("numeric fields and native JSON use the driver decoder unchanged", () => {
  for (const field of [{ type: "TINY", length: 3 }, { type: "LONG" },
    { type: "JSON" }, { type: "BLOB", extendedFormat: "json" }]) {
    const value = { decoded: true };
    assert.equal(typeCast(field, () => value), value);
  }
});
