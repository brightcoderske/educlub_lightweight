const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMarkableQuestions, QUIZ_QUESTION_SCHEMA } = require("../src/services/aiQuizQuestions");
const { answersMatch } = require("../src/services/quizAnswerPolicy");

/**
 * The point of these is not that the normaliser produces some shape, but that
 * what it produces can actually be marked. Every "keeps" test feeds the result
 * back through the real grader.
 */
function marks(question, learnerAnswer) {
  return answersMatch(question.correct_answer, learnerAnswer, question.question_type);
}

test("a multiple choice question survives and marks both ways", () => {
  const { questions, rejected } = buildMarkableQuestions([
    {
      question_type: "multiple_choice",
      prompt: "Which block starts a script?",
      options: ["when green flag clicked", "move 10 steps"],
      correct_answer: "when green flag clicked",
      points: 2,
    },
  ]);

  assert.equal(rejected.length, 0);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].points, 2);
  assert.equal(marks(questions[0], "when green flag clicked"), true);
  assert.equal(marks(questions[0], "move 10 steps"), false);
});

test("a correct answer that is not one of the options is discarded", () => {
  // The most common model error: the answer paraphrases an option rather than
  // repeating it, so the learner can never select it and nobody ever scores.
  const { questions, rejected } = buildMarkableQuestions([
    {
      question_type: "multiple_choice",
      prompt: "Which block repeats?",
      options: ["repeat 10", "say Hello"],
      correct_answer: "the repeat block",
    },
  ]);

  assert.equal(questions.length, 0);
  assert.equal(rejected[0].reason, "correct answer is not among the options");
});

test("a question with no correct answer is discarded rather than saved unmarkable", () => {
  const { questions, rejected } = buildMarkableQuestions([
    { question_type: "multiple_choice", prompt: "Pick one", options: ["a", "b"], correct_answer: "" },
    { question_type: "short_answer", prompt: "Name a loop", correct_answer: null },
  ]);

  assert.equal(questions.length, 0);
  assert.equal(rejected.length, 2);
  assert.ok(rejected.every((item) => item.reason === "no usable correct answer"));
});

test("true_false is coerced to a real boolean, whatever the model wrote", () => {
  const { questions } = buildMarkableQuestions([
    { question_type: "true_false", prompt: "Sprites have costumes.", correct_answer: "true" },
    { question_type: "true_false", prompt: "Cats bark.", correct_answer: "No" },
  ]);

  assert.equal(questions[0].correct_answer, true);
  assert.equal(questions[1].correct_answer, false);
  // Options are supplied even when the model omitted them, or the learner has
  // nothing to click.
  assert.deepEqual(questions[0].options, ["True", "False"]);
  assert.equal(marks(questions[0], true), true);
  assert.equal(marks(questions[1], "false"), true);
  assert.equal(marks(questions[1], true), false);
});

test("short_answer collects every acceptable wording", () => {
  const { questions } = buildMarkableQuestions([
    {
      question_type: "short_answer",
      prompt: "Which block loops forever?",
      correct_answer: "forever",
      acceptable_answers: ["forever block", "the forever block"],
    },
  ]);

  assert.deepEqual(questions[0].correct_answer, ["forever", "forever block", "the forever block"]);
  assert.equal(marks(questions[0], "Forever Block"), true, "matching is case and space insensitive");
  assert.equal(marks(questions[0], "repeat"), false);
});

test("matching survives as an object, including when the model sent pairs", () => {
  const { questions } = buildMarkableQuestions([
    {
      question_type: "matching",
      prompt: "Match block to job.",
      options: [
        { left: "move 10 steps", right: "moves the sprite" },
        { left: "say Hello", right: "shows a bubble" },
      ],
      pairs: [
        { left: "move 10 steps", right: "moves the sprite" },
        { left: "say Hello", right: "shows a bubble" },
      ],
    },
  ]);

  assert.deepEqual(questions[0].correct_answer, {
    "move 10 steps": "moves the sprite",
    "say Hello": "shows a bubble",
  });
  // Options keep their pair shape. Stringifying them produced "[object Object]"
  // before, which made every matching question unanswerable.
  assert.equal(questions[0].options[0].left, "move 10 steps");
  assert.equal(
    marks(questions[0], { "move 10 steps": "moves the sprite", "say Hello": "shows a bubble" }),
    true,
  );
  assert.equal(marks(questions[0], { "move 10 steps": "shows a bubble" }), false);
});

test("ordering keeps its order and is marked in order", () => {
  const { questions } = buildMarkableQuestions([
    {
      question_type: "ordering",
      prompt: "Order the steps.",
      options: ["sprite moves", "click green flag", "project stops"],
      correct_order: ["click green flag", "sprite moves", "project stops"],
    },
  ]);

  assert.deepEqual(questions[0].correct_answer, [
    "click green flag",
    "sprite moves",
    "project stops",
  ]);
  assert.equal(marks(questions[0], ["click green flag", "sprite moves", "project stops"]), true);
  assert.equal(marks(questions[0], ["sprite moves", "click green flag", "project stops"]), false);
});

test("multi_select marks only the full set", () => {
  const { questions } = buildMarkableQuestions([
    {
      question_type: "multi_select",
      prompt: "Which are loops?",
      options: ["repeat 10", "forever", "say Hi"],
      correct_answer: ["repeat 10", "forever"],
    },
  ]);

  assert.equal(questions[0].question_type, "multi_select");
  assert.equal(marks(questions[0], ["forever", "repeat 10"]), true, "order must not matter");
  assert.equal(marks(questions[0], ["repeat 10"]), false, "a partial answer is not correct");
});

test("an unsupported question_type falls back rather than being saved unrenderable", () => {
  const { questions } = buildMarkableQuestions([
    {
      question_type: "predict_the_output",
      prompt: "What prints?",
      options: ["Hello", "Goodbye"],
      correct_answer: "Hello",
    },
  ]);

  // The learner UI can only render six types; anything else would save but
  // never display.
  assert.equal(questions[0].question_type, "multiple_choice");
  assert.equal(marks(questions[0], "Hello"), true);
});

test("ids and positions are assigned in order, skipping discarded questions", () => {
  const { questions } = buildMarkableQuestions(
    [
      { question_type: "multiple_choice", prompt: "Keep A", options: ["a", "b"], correct_answer: "a" },
      { question_type: "multiple_choice", prompt: "Drop", options: ["a", "b"], correct_answer: "zzz" },
      { question_type: "multiple_choice", prompt: "Keep B", options: ["a", "b"], correct_answer: "b" },
    ],
    { activityId: "act7" },
  );

  assert.deepEqual(
    questions.map((q) => [q.id, q.position, q.prompt]),
    [
      ["act7-q1", 1, "Keep A"],
      ["act7-q2", 2, "Keep B"],
    ],
  );
});

test("the prompt schema documents every supported type with a worked example", () => {
  for (const type of [
    "multiple_choice",
    "multi_select",
    "true_false",
    "short_answer",
    "matching",
    "ordering",
  ]) {
    assert.ok(QUIZ_QUESTION_SCHEMA.includes(`"question_type":"${type}"`), `${type} has no example`);
  }
  // The instruction that stops the model burying the quiz in decorative markup.
  assert.match(QUIZ_QUESTION_SCHEMA, /Do not put the quiz inside rich_html/);
});
