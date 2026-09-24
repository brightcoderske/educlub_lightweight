import { formatDay, promotionTermOptions, suggestedNextTerm } from "../lib/promotionTerms";

const term = (name, year, start, end, extra = {}) => ({
  name,
  academic_year: year,
  start_date: start,
  end_date: end,
  term_type: "regular",
  ...extra,
});

const TERMS = [
  term("Term 1", 2026, "2026-01-05", "2026-04-03"),
  term("Term 2", 2026, "2026-04-27", "2026-08-07"),
  term("Term 3", 2026, "2026-09-01", "2026-11-27"),
  term("Term 1", 2027, "2027-01-04", "2027-04-02"),
  term("Term 2", 2027, "2027-04-26", "2027-08-06"),
];
// A day inside Term 3 2026.
const NOW = new Date(2026, 8, 24);

// The dropdown used to list "Term 1" once for every academic year that has one,
// beside a separate year picker, so nothing tied a term to its year.
test("each real term is offered once, with its year, earliest first", () => {
  const options = promotionTermOptions(TERMS, NOW);

  expect(options.map((option) => option.label)).toEqual([
    "Term 3 2026 (current)",
    "Term 1 2027",
    "Term 2 2027",
  ]);
  expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
});

test("two terms with the same name in different years are two different options", () => {
  const options = promotionTermOptions(
    [
      term("Term 1", 2027, "2027-01-04", "2027-04-02"),
      term("Term 1", 2028, "2028-01-03", "2028-04-07"),
    ],
    NOW
  );

  expect(options.map((option) => option.label)).toEqual(["Term 1 2027", "Term 1 2028"]);
  expect(options[0].value).not.toBe(options[1].value);
  // Choosing one decides both halves of what is sent.
  expect(options[1]).toMatchObject({ name: "Term 1", academicYear: 2028 });
});

test("a term that has finished is somewhere a class moves from, not to", () => {
  const labels = promotionTermOptions(TERMS, NOW).map((option) => option.label);

  expect(labels).not.toContain("Term 1 2026");
  expect(labels).not.toContain("Term 2 2026");
});

test("only regular terms are offered, and a term with no academic year is not", () => {
  const options = promotionTermOptions(
    [
      ...TERMS,
      term("Holiday Camp", 2026, "2026-12-01", "2026-12-20", { term_type: "holiday_program" }),
      term("Orphan", null, "2027-05-01", "2027-06-01"),
    ],
    NOW
  );

  expect(options.map((option) => option.name)).not.toContain("Holiday Camp");
  expect(options.map((option) => option.name)).not.toContain("Orphan");
});

test("the term that is running is marked, and carries its dates", () => {
  const [current, next] = promotionTermOptions(TERMS, NOW);

  expect(current.isCurrent).toBe(true);
  expect(next.isCurrent).toBe(false);
  expect(next.dates).toBe("4 Jan 2027 to 2 Apr 2027");
});

test("dates that arrive with a time on the end are read the same way", () => {
  const [option] = promotionTermOptions(
    [term("Term 1", 2027, "2027-01-04T00:00:00.000Z", "2027-04-02T00:00:00.000Z")],
    NOW
  );

  expect(option.dates).toBe("4 Jan 2027 to 2 Apr 2027");
});

test("the suggested term is the first one that has not started yet", () => {
  const options = promotionTermOptions(TERMS, NOW);

  expect(suggestedNextTerm(options, NOW).label).toBe("Term 1 2027");
});

test("with no later term set up, nothing is suggested and the operator has to say", () => {
  const onlyCurrent = promotionTermOptions([TERMS[2]], NOW);

  expect(suggestedNextTerm(onlyCurrent, NOW)).toBeNull();
  expect(suggestedNextTerm([], NOW)).toBeNull();
  expect(promotionTermOptions(undefined, NOW)).toEqual([]);
});

test("a day is written out plainly, and nonsense is left blank", () => {
  expect(formatDay("2026-09-01")).toBe("1 Sep 2026");
  expect(formatDay("")).toBe("");
  expect(formatDay(null)).toBe("");
});
