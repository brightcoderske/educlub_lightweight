const test = require("node:test");
const assert = require("node:assert/strict");

const { assertUsableEmail, isPlaceholderEmail } = require("../src/services/userEmail.service");

// Learner accounts are created with a generated <name>@learners.educlub.local
// address. Nothing can be delivered to it, so a learner who forgot their
// password had no way back in without an administrator.
test("a generated placeholder address is recognised as not deliverable", () => {
  assert.equal(isPlaceholderEmail("annamani@learners.educlub.local"), true);
  assert.equal(isPlaceholderEmail("anna@gmail.com"), false);
});

test("a real address is accepted, trimmed and lower-cased", () => {
  assert.equal(assertUsableEmail("  Anna.Mani@Gmail.COM "), "anna.mani@gmail.com");
});

test("an address that cannot receive mail is refused with a message a child can act on", () => {
  const cases = [
    ["", "Enter an email address."],
    ["nope", "Enter a complete email address, like yourname@gmail.com."],
    [
      "annamani@learners.educlub.local",
      "Use a real email address you can open, not an eduClub placeholder.",
    ],
  ];

  for (const [value, message] of cases) {
    assert.throws(
      () => assertUsableEmail(value),
      (error) => error.message === message && error.statusCode === 400,
      `expected ${JSON.stringify(value)} to be refused`,
    );
  }
});
