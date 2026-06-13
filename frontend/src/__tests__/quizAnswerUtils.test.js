import {
  addAcceptableAnswer,
  normalizeAcceptableAnswers,
  removeAcceptableAnswer,
  updateAcceptableAnswer,
} from "../layouts/weekly-learning/quizAnswerUtils";

test("typed quiz answers remain a teacher-friendly list", () => {
  expect(normalizeAcceptableAnswers("CPU")).toEqual(["CPU"]);
  expect(normalizeAcceptableAnswers(["CPU", "Central Processing Unit"])).toEqual([
    "CPU",
    "Central Processing Unit",
  ]);
  expect(addAcceptableAnswer(["CPU"])).toEqual(["CPU", ""]);
  expect(updateAcceptableAnswer(["CPU", ""], 1, "Central Processing Unit")).toEqual([
    "CPU",
    "Central Processing Unit",
  ]);
  expect(removeAcceptableAnswer(["CPU", "Central Processing Unit"], 0)).toEqual([
    "Central Processing Unit",
  ]);
  expect(removeAcceptableAnswer(["CPU"], 0)).toEqual([""]);
});
