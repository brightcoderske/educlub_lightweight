import { similarLearners } from "lib/similarLearners";

const SCHOOL = [
  { id: 1, full_name: "Kevin Otieno Ouma", grade: "Grade 5", stream: "A" },
  { id: 2, full_name: "Grace Wanjiru", grade: "Grade 6", stream: "B" },
  { id: 3, full_name: "Kelvin Mwangi", grade: "Grade 7", stream: "A" },
  { id: 4, full_name: "Ann Atieno", grade: "Grade 5", stream: "A" },
];
const names = (results) => results.map((entry) => entry.learner.full_name);

test("nothing is suggested before a name is typed", () => {
  expect(similarLearners(SCHOOL, ["", " ", ""])).toEqual([]);
});

test("a name being typed finds learners whose names start with it", () => {
  expect(names(similarLearners(SCHOOL, ["Kev", "", ""]))).toEqual(["Kevin Otieno Ouma"]);
});

test("the same name in another order is marked as the same name, first", () => {
  const results = similarLearners(SCHOOL, ["Wanjiru", "Grace", ""]);
  expect(names(results)[0]).toBe("Grace Wanjiru");
  expect(results[0].sameName).toBe(true);
});

test("a one-letter slip still finds the learner", () => {
  expect(names(similarLearners(SCHOOL, ["Grace", "Wanjiro", ""]))).toEqual(["Grace Wanjiru"]);
  expect(names(similarLearners(SCHOOL, ["Kelvin", "", ""]))).toContain("Kevin Otieno Ouma");
});

test("more shared words rank higher, and a partial match is not the same name", () => {
  const results = similarLearners(SCHOOL, ["Kevin", "Otieno", ""]);
  expect(names(results)[0]).toBe("Kevin Otieno Ouma");
  expect(results[0].sameName).toBe(false);
});

test("a name nobody shares finds nothing", () => {
  expect(similarLearners(SCHOOL, ["Zawadi", "Chebet", ""])).toEqual([]);
});
