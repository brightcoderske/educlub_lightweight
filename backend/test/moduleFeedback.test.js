const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateFeedback,
  anonymizeFeedbackRow,
} = require("../src/services/moduleFeedback.service");

test("module feedback requires a rating from one to five", () => {
  assert.throws(() => validateFeedback({ rating: 0 }), /1 and 5/);
  assert.throws(() => validateFeedback({ rating: 6 }), /1 and 5/);
  assert.equal(validateFeedback({ rating: 5, comment: "Helpful" }).rating, 5);
});

test("school feedback views never expose learner identity", () => {
  const row = anonymizeFeedbackRow({
    id: 1,
    learner_id: 44,
    learner_name: "Private Learner",
    rating: 4,
    comment: "More examples please.",
  });
  assert.equal(row.learner_id, undefined);
  assert.equal(row.learner_name, undefined);
  assert.equal(row.comment, "More examples please.");
});
