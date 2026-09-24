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

// The one rule for "can mail reach this address": the same check an address
// passes when it is entered is the check applied before something is sent to it.
test("an address is deliverable exactly when it would have been accepted", () => {
  const { isDeliverableEmail } = require("../src/services/userEmail.service");

  assert.equal(isDeliverableEmail("anna@gmail.com"), true);
  assert.equal(isDeliverableEmail("  Anna.Mani@Gmail.COM "), true);

  // The generated placeholder, and any other .local address, cannot receive mail.
  assert.equal(isDeliverableEmail("annamani@learners.educlub.local"), false);
  assert.equal(isDeliverableEmail("someone@office.LOCAL"), false);

  for (const unusable of ["", "   ", null, undefined, "nope", "a@b", "two words@x.com"]) {
    assert.equal(isDeliverableEmail(unusable), false, `${JSON.stringify(unusable)} is not deliverable`);
  }
  assert.equal(isDeliverableEmail(`${"a".repeat(250)}@x.com`), false, "longer than the column holds");
});
