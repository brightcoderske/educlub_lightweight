const test = require("node:test");
const assert = require("node:assert/strict");

const {
  prepareModuleForPdf,
  modulePdfFilename,
} = require("../src/services/modulePdf.service");

test("prepareModuleForPdf removes answers and quiz explanations recursively", () => {
  const prepared = prepareModuleForPdf(
    {
      course: { name: "Scratch Intermediate" },
      module: {
        title: "Lists",
        activities: [
          {
            title: "List Quiz",
            content: {
              instructions: "Choose carefully",
              questions: [
                {
                  question_type: "multiple_choice",
                  prompt: "Which block adds an item?",
                  options: ["add", "delete"],
                  correct_answer: "add",
                  answer: "add",
                  explanation: "The add block appends an item.",
                  choices: [
                    { text: "add", is_correct: true },
                    { text: "delete", correct: false },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
    (items) => [...items].reverse(),
  );

  const question = prepared.module.activities[0].content.questions[0];
  assert.equal(question.correct_answer, undefined);
  assert.equal(question.answer, undefined);
  assert.equal(question.explanation, undefined);
  assert.equal(question.choices[0].is_correct, undefined);
  assert.equal(question.choices[1].correct, undefined);
  assert.equal(question.prompt, "Which block adds an item?");
  assert.deepEqual(question.options, ["add", "delete"]);
});

test("prepareModuleForPdf shuffles ordering choices while preserving every choice", () => {
  const prepared = prepareModuleForPdf(
    {
      course: { name: "Scratch Intermediate" },
      module: {
        title: "Algorithms",
        activities: [
          {
            title: "Put it in order",
            content: {
              questions: [
                {
                  question_type: "ordering",
                  prompt: "Order the game steps",
                  options: ["Start", "Move", "Score", "End"],
                  correct_answer: ["Start", "Move", "Score", "End"],
                },
              ],
            },
          },
        ],
      },
    },
    (items) => [...items].reverse(),
  );

  const options = prepared.module.activities[0].content.questions[0].options;
  assert.deepEqual(options, ["End", "Score", "Move", "Start"]);
  assert.deepEqual([...options].sort(), ["End", "Move", "Score", "Start"]);
});

test("modulePdfFilename creates a filesystem-safe branded filename", () => {
  assert.equal(
    modulePdfFilename("Scratch: Games / Animation", "Module 1? Lists"),
    "educlub-scratch-games-animation-module-1-lists.pdf",
  );
});
