const test = require("node:test");
const assert = require("node:assert/strict");
const PDFDocument = require("pdfkit");

const {
  fittingFontSize,
  generateUniqueUsername,
  generateUsernameFromName,
} = require("../src/services/learners.service");

// A learner's username used to be the first eight letters of their whole name,
// so "Floyed Muchiri" became "floyedmu": the surname was lost and two learners
// whose names began alike shared a base.
test("a username is the first and last name, in lower-case letters and digits", () => {
  const cases = [
    ["Floyed Muchiri", "floyedmuchiri"],
    ["Mwangi", "mwangi"],
    ["  Kevin   Otieno ", "kevinotieno"],
    // Middle names make a long username nobody remembers; a clash is settled by a number.
    ["Anna Wanjiru Kamau", "annakamau"],
    // Accents fold rather than vanish, and punctuation goes without splitting a name.
    ["José Álvarez", "josealvarez"],
    ["Mary-Jane O'Brien", "maryjaneobrien"],
  ];

  for (const [name, expected] of cases) {
    assert.equal(generateUsernameFromName(name), expected, `${JSON.stringify(name)}`);
  }
});

test("a very long name is capped at twenty letters, not cut at eight", () => {
  const username = generateUsernameFromName("Bartholomew Wanyonyi-Wafula");

  assert.equal(username, "bartholomewwanyonyiw");
  assert.equal(username.length, 20);
});

test("a name with nothing to build a username from still gets one", () => {
  for (const name of ["李雷", "---", "", "   ", null, undefined]) {
    assert.equal(generateUsernameFromName(name), "learner", `${JSON.stringify(name)}`);
  }
});

// Stands in for the database: every existing username that starts with the pattern.
function usernamesTaken(existing) {
  const calls = [];
  const executor = async (sql, params) => {
    calls.push({ sql, params });
    const prefix = params[0].slice(0, -1);
    return {
      rows: existing.filter((name) => name.toLowerCase().startsWith(prefix)).map((username) => ({ username })),
    };
  };
  executor.calls = calls;
  return executor;
}

test("the name comes first, and a number is added only when it is taken", async () => {
  assert.equal(await generateUniqueUsername("Floyed Muchiri", usernamesTaken([])), "floyedmuchiri");
  assert.equal(
    await generateUniqueUsername("Floyed Muchiri", usernamesTaken(["floyedmuchiri"])),
    "floyedmuchiri1",
  );
  assert.equal(
    await generateUniqueUsername("Floyed Muchiri", usernamesTaken(["floyedmuchiri", "floyedmuchiri1"])),
    "floyedmuchiri2",
  );
});

test("the smallest free number is used, so a gap is filled before the list grows", async () => {
  const taken = usernamesTaken(["floyedmuchiri", "floyedmuchiri2", "floyedmuchiri3"]);

  assert.equal(await generateUniqueUsername("Floyed Muchiri", taken), "floyedmuchiri1");
});

test("a username is taken whatever its case", async () => {
  const taken = usernamesTaken(["FloyedMuchiri"]);

  assert.equal(await generateUniqueUsername("Floyed Muchiri", taken), "floyedmuchiri1");
});

test("a different name that merely starts the same does not block it", async () => {
  // "floyedmuchirigeorge" is someone else's base, not floyedmuchiri plus a number.
  const taken = usernamesTaken(["floyedmuchirigeorge", "floyedmuchiri.old"]);

  assert.equal(await generateUniqueUsername("Floyed Muchiri", taken), "floyedmuchiri");
});

test("everything that could clash is fetched in one query, however many there are", async () => {
  const existing = ["floyedmuchiri", ...Array.from({ length: 40 }, (_, index) => `floyedmuchiri${index + 1}`)];
  const executor = usernamesTaken(existing);

  assert.equal(await generateUniqueUsername("Floyed Muchiri", executor), "floyedmuchiri41");
  assert.equal(executor.calls.length, 1);
  assert.equal(executor.calls[0].params[0], "floyedmuchiri%");
});

test("the lookup ignores case in the database, because the column itself does not", async () => {
  // users.username compares case-sensitively, so a plain LIKE would never see
  // "FloyedMuchiri". Sign-in matches LOWER(username), which is why that matters.
  const executor = usernamesTaken([]);

  await generateUniqueUsername("Floyed Muchiri", executor);

  assert.match(executor.calls[0].sql, /WHERE LOWER\(username\) LIKE \$1/);
});

test("learners with nothing to build on take learner, learner1, learner2", async () => {
  assert.equal(await generateUniqueUsername("李雷", usernamesTaken(["learner", "learner1"])), "learner2");
});

// A username is now as long as the learner's name, so the printed credential
// card has to cope: it used to assume eight letters and would run off the edge.
test("a long username is shrunk to fit the card, never wrapped or cut short", () => {
  const doc = new PDFDocument({ size: "A4", margin: 28 });
  doc.font("Helvetica-Bold");
  const cardTextWidth = 170 - 24;

  assert.equal(fittingFontSize(doc, "Username: floyedmuchiri1", cardTextWidth), 9, "an ordinary one keeps its size");

  const long = "Username: bartholomewwanyonyiw99";
  const size = fittingFontSize(doc, long, cardTextWidth);
  assert.ok(size < 9 && size >= 6, `shrunk to ${size}`);
  assert.ok(doc.fontSize(size).widthOfString(long) <= cardTextWidth, "and now it fits");

  assert.equal(fittingFontSize(doc, "x".repeat(200), cardTextWidth), 6, "there is a floor below which it stays readable");
});
