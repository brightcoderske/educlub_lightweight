const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A learner reaches PUT /learners/:id for their own record, because that is how
// they change the grade they are in. Everything else on that record is
// placement data an operator owns: stream, term, academic year and email feed
// allocations, report cards and promotion, so a learner writing to them moves
// themselves out of their own class with no operator involved. The profile
// screen renders those read-only, and this is what makes that a rule rather
// than a presentation choice.
function updateLearner() {
  const text = fs.readFileSync(
    path.join(__dirname, "..", "src/controllers/learners.controller.js"),
    "utf8",
  );
  const start = text.indexOf("async function updateLearner(");
  assert.notEqual(start, -1, "updateLearner not found");
  const next = text.indexOf("\nasync function ", start + 1);
  return text.slice(start, next === -1 ? text.length : next);
}

test("a learner editing their own record keeps the placement fields they were given", () => {
  const handler = updateLearner();

  assert.match(handler, /const selfEdit = req\.user\.role === "learner"/);

  for (const field of ["email", "term", "academic_year", "stream"]) {
    assert.match(
      handler,
      new RegExp(`!selfEdit && ${field} !== undefined`),
      `${field} is writable by the learner it belongs to`,
    );
  }
});

test("a learner cannot promote themselves through next_grade or next_term", () => {
  const handler = updateLearner();

  assert.match(handler, /selfEdit \? existingLearner\.next_grade :/);
  assert.match(handler, /selfEdit \? existingLearner\.next_term :/);
  assert.match(handler, /req\.user\.role === "learner"\s*\?\s*existingLearner\.full_name/);
});

test("a grade a learner submits is normalised, and a bad one is refused rather than nulled", () => {
  const handler = updateLearner();

  assert.match(handler, /nextGrade = normalizeGrade\(grade\)/);
  assert.match(handler, /if \(selfEdit && !nextGrade\)/);
  assert.match(handler, /status\(400\)/);
  assert.match(handler, /Grade 1 and Grade 12/);
});
