import { act, Simulate } from "react-dom/test-utils";
import PromoteLearnersDialog from "../layouts/school-admin/learners/PromoteLearnersDialog";
import { renderInApp } from "../testRender";

// Dates are set relative to today so these never go stale: a term that is running,
// two to come, and one that is over.
const iso = (offsetDays) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const YEAR = new Date().getFullYear();
const term = (name, academicYear, start, end) => ({
  name,
  academic_year: academicYear,
  start_date: iso(start),
  end_date: iso(end),
  term_type: "regular",
});
const TERMS = [
  term("Term A", YEAR, -30, 30),
  term("Term B", YEAR, 60, 150),
  term("Term C", YEAR + 1, 200, 290),
  term("Term Z", YEAR - 1, -400, -300),
];

const LEARNERS = [
  { id: 1, full_name: "Anna Mani", grade: "Grade 5", stream: "A", graduation_status: "active" },
  { id: 2, full_name: "Kevin Otieno", grade: "Grade 5", stream: "B", graduation_status: "active" },
  { id: 3, full_name: "Grace Wanjiru", grade: "Grade 6", stream: "A", graduation_status: "active" },
  { id: 4, full_name: "Old Timer", grade: "Grade 5", stream: "A", graduation_status: "graduated" },
];

async function open(props = {}) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const view = await renderInApp(
    <PromoteLearnersDialog
      learners={LEARNERS}
      grades={["Grade 5", "Grade 6", "Grade 7"]}
      streams={["A", "B"]}
      academicTerms={TERMS}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  );
  return { ...view, onConfirm, onClose };
}

const field = (label) => {
  const found = Array.from(document.body.querySelectorAll("label")).find((item) =>
    item.textContent.trim().startsWith(label)
  );
  return document.getElementById(found.htmlFor);
};
const choose = (label, value) =>
  act(async () => Simulate.change(field(label), { target: { value } }));
const button = (pattern) =>
  Array.from(document.body.querySelectorAll("button")).find((item) =>
    pattern.test(item.textContent)
  );
const summary = () => document.body.querySelector('[data-testid="promotion-summary"]')?.textContent;
const optionLabels = (select) =>
  Array.from(select.querySelectorAll("option")).map((item) => item.textContent);

test("it asks which term first, as one dropdown of the terms that exist", async () => {
  const { unmount } = await open();

  expect(document.body.textContent).toMatch(/1\. Which term are they moving to\?/);
  const select = field("Next term");
  expect(optionLabels(select)).toEqual([
    "Choose a term",
    `Term A ${YEAR} (current)`,
    `Term B ${YEAR}`,
    `Term C ${YEAR + 1}`,
  ]);
  expect(optionLabels(select).join()).not.toMatch(/Term Z/);

  await unmount();
});

test("it starts on the term after the current one", async () => {
  const { unmount } = await open();

  expect(field("Next term").value).toBe(`${YEAR}|Term B`);
  expect(summary()).toMatch(new RegExp(`will move to Term B ${YEAR}\\.$`));

  await unmount();
});

test("it says how many will move, and never counts someone who has graduated", async () => {
  const { unmount } = await open();

  expect(summary()).toMatch(/^3 learners across the school will move/);
  expect(button(/^Graduate 3 learners$/)).toBeTruthy();

  await choose("Grade", "Grade 5");
  expect(summary()).toMatch(/^2 learners in Grade 5 will move/);

  await choose("Class / stream", "B");
  expect(summary()).toMatch(/^1 learner in Grade 5, class B will move/);
  expect(button(/^Graduate 1 learner$/)).toBeTruthy();

  await unmount();
});

test("one chosen learner is named, and the grade and class no longer apply", async () => {
  const { unmount } = await open();

  await choose("Learners", "3");

  expect(summary()).toMatch(/^Grace Wanjiru will move to/);
  expect(field("Grade").disabled).toBe(true);
  expect(field("Class / stream").disabled).toBe(true);

  await unmount();
});

test("the term and its own year are sent together, with who is moving", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Grade", "Grade 5");
  await choose("Next grade", "Grade 6");
  await act(async () => Simulate.click(button(/^Graduate 2 learners$/)));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith({
    grade: "Grade 5",
    next_term: "Term B",
    academic_year: YEAR,
    next_grade: "Grade 6",
  });

  await unmount();
});

test("choosing a later year's term sends that year, not this one", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Next term", `${YEAR + 1}|Term C`);
  await act(async () => Simulate.click(button(/^Graduate 3 learners$/)));

  expect(onConfirm.mock.calls[0][0]).toMatchObject({
    next_term: "Term C",
    academic_year: YEAR + 1,
  });
  expect(onConfirm.mock.calls[0][0]).not.toHaveProperty("next_grade");

  await unmount();
});

test("a chosen learner is sent by id, without a grade or class filter", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Learners", "3");
  await act(async () => Simulate.click(button(/^Graduate 1 learner$/)));

  expect(onConfirm.mock.calls[0][0]).toEqual({
    learner_ids: [3],
    next_term: "Term B",
    academic_year: YEAR,
  });

  await unmount();
});

test("nothing can be confirmed until a term is chosen", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Next term", "");

  expect(button(/^Graduate 3 learners$/).disabled).toBe(true);
  expect(summary()).toBe("Choose the term they are moving to.");
  await act(async () => Simulate.click(button(/^Graduate 3 learners$/)));
  expect(onConfirm).not.toHaveBeenCalled();

  await unmount();
});

test("with no term set up it says what to do instead of offering nothing", async () => {
  const { unmount } = await open({ academicTerms: [] });

  expect(document.body.textContent).toMatch(/No current or upcoming term is set up/);
  expect(document.body.textContent).toMatch(/Academic Years and\s+Terms/);
  expect(field("Next term").disabled).toBe(true);
  expect(button(/^Graduate/).disabled).toBe(true);

  await unmount();
});

test("a class nobody is in cannot be graduated", async () => {
  const { unmount } = await open();

  await choose("Grade", "Grade 7");

  expect(summary()).toMatch(/^0 learners in Grade 7 will move/);
  expect(button(/^Graduate 0 learners$/).disabled).toBe(true);

  await unmount();
});

test("a failure is shown in the dialog, where the operator is looking", async () => {
  const { unmount } = await open({ error: 'Term "Term B" does not exist.' });

  expect(document.body.textContent).toContain('Term "Term B" does not exist.');

  await unmount();
});

test("Cancel leaves without moving anyone", async () => {
  const { unmount, onClose, onConfirm } = await open();

  await act(async () => Simulate.click(button(/^Cancel$/)));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();

  await unmount();
});
