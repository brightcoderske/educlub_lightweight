const test = require("node:test");
const assert = require("node:assert/strict");

const { escapeHtml } = require("../src/utils/html");

test("the four characters that let text become markup are escaped", () => {
  assert.equal(
    escapeHtml(`<a href="x">Tom & Jerry</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;",
  );
});

test("an ampersand is escaped first, so escapes are not escaped twice", () => {
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("plain text, numbers and a missing value come out as plain text", () => {
  assert.equal(escapeHtml("Anna Mani"), "Anna Mani");
  assert.equal(escapeHtml(30), "30");
  assert.equal(escapeHtml(), "");
});
