const test = require("node:test");
const assert = require("node:assert/strict");

// Creating a learner hands the admin the username and the default password, to
// give to the learner on a printed card. It used to hand over the whole account
// row as well - password hash included - and bulk import forwarded that row for
// every learner in the file.
//
// The stand-in for the database is installed before the service is loaded,
// because it takes its dependencies at load time.
const config = require("../src/config");

const HASH = "$2b$10$thehashofthedefaultpasswordthatnobodyshouldsee";
config.query = async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ").trim();
  if (/^SELECT username FROM users WHERE LOWER\(username\) LIKE/.test(sql)) return { rows: [], rowCount: 0 };
  if (/^INSERT INTO users/.test(sql)) {
    return {
      rows: [{ id: 11, email: params[0], password: HASH, role: "learner", username: params[5], mfa_code: null, force_password_reset: true }],
      rowCount: 1,
    };
  }
  if (/^INSERT INTO learners/.test(sql)) {
    return { rows: [{ id: 21, user_id: 11, full_name: params[2], grade: params[4] }], rowCount: 1 };
  }
  throw new Error(`a learner creation test ran a statement it has no answer for: ${sql}`);
};

const learnersService = require("../src/services/learners.service");

const learner = {
  school_id: 2,
  full_name: "Floyed Muchiri",
  grade: "Grade 5",
  term: "Term 1",
  academic_year: 2027,
  stream: null,
};

test("the admin is given the username and the default password to hand over", async () => {
  const result = await learnersService.createLearner(learner);

  assert.equal(result.username, "floyedmuchiri");
  assert.ok(result.plainPassword, "the default password, printed on the learner's card");
  assert.equal(result.learner.id, 21);
});

test("the account comes back as who it is, never with its password hash", async () => {
  const result = await learnersService.createLearner(learner);

  assert.deepEqual(result.user, {
    id: 11,
    email: "floyedmuchiri@learners.educlub.local",
    username: "floyedmuchiri",
    role: "learner",
  });
  const everything = JSON.stringify(result);
  assert.ok(!everything.includes(HASH), "no hash anywhere in the result");
  assert.doesNotMatch(everything, /"password"/, "and no password field");
  assert.doesNotMatch(everything, /mfa_code|force_password_reset/, "and none of the rest of the row");
});
