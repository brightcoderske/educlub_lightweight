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
const tickbox = (name) => document.body.querySelector(`input[aria-label="${name}"]`);
const tick = (name) =>
  act(async () => Simulate.change(tickbox(name), { target: { checked: true } }));
const tickAllShown = () =>
  act(async () => Simulate.change(tickbox("Tick everyone shown"), { target: { checked: true } }));
const summary = () => document.body.querySelector('[data-testid="promotion-summary"]')?.textContent;
const hidden = () => document.body.querySelector('[data-testid="promotion-hidden"]')?.textContent;
const listed = () =>
  Array.from(document.body.querySelectorAll('input[type="checkbox"]'))
    .map((input) => input.getAttribute("aria-label"))
    .filter((name) => name && name !== "Tick everyone shown");
const optionLabels = (select) =>
  Array.from(select.querySelectorAll("option")).map((item) => item.textContent);

test("terms are one dropdown of the terms that exist, starting on the next one", async () => {
  const { unmount } = await open();

  expect(optionLabels(field("Next term"))).toEqual([
    "Keep their current term",
    `Term A ${YEAR} (current)`,
    `Term B ${YEAR}`,
    `Term C ${YEAR + 1}`,
  ]);
  expect(field("Next term").value).toBe(`${YEAR}|Term B`);

  await unmount();
});

test("everyone who has not graduated is listed with their grade and class", async () => {
  const { unmount } = await open();

  expect(listed()).toEqual(["Anna Mani", "Kevin Otieno", "Grace Wanjiru"]);
  expect(document.body.textContent).toContain("Grade 5 · A");
  expect(document.body.textContent).not.toContain("Old Timer");

  await unmount();
});

test("ticks survive filtering, and the count says how many are hidden", async () => {
  const { unmount } = await open();

  await tick("Anna Mani");
  await choose("Grade", "Grade 6");
  expect(listed()).toEqual(["Grace Wanjiru"]);
  await tick("Grace Wanjiru");

  expect(summary()).toMatch(/^2 learners ticked will move to Term B/);
  expect(hidden()).toBe("(1 not shown by the filters)");

  await choose("Grade", "");
  expect(tickbox("Anna Mani").checked).toBe(true);
  expect(tickbox("Grace Wanjiru").checked).toBe(true);
  expect(hidden()).toBeUndefined();

  await unmount();
});

test("ticking everyone shown takes only the learners the filters show", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Class / stream", "A");
  await tickAllShown();
  await choose("Class / stream", "");

  expect(tickbox("Kevin Otieno").checked).toBe(false);
  await act(async () => Simulate.click(button(/^Move 2 learners$/)));
  expect(onConfirm.mock.calls[0][0].learner_ids).toEqual([1, 3]);

  await unmount();
});

test("the search finds learners by name", async () => {
  const { unmount } = await open();

  await act(async () => Simulate.change(field("Search name"), { target: { value: "kev" } }));

  expect(listed()).toEqual(["Kevin Otieno"]);

  await unmount();
});

test("moving each up one grade is sent as 'up' with the ticked learners and the term", async () => {
  const { unmount, onConfirm } = await open();

  await tick("Anna Mani");
  await tick("Grace Wanjiru");
  await choose("Next class", "up");
  expect(summary()).toMatch(/will move to Term B \d+ and each up one grade\.$/);
  await act(async () => Simulate.click(button(/^Move 2 learners$/)));

  expect(onConfirm).toHaveBeenCalledWith({
    learner_ids: [1, 3],
    next_term: "Term B",
    academic_year: YEAR,
    next_grade: "up",
  });

  await unmount();
});

test("a class move alone, with the term kept, sends no term", async () => {
  const { unmount, onConfirm } = await open();

  await choose("Next term", "");
  await choose("Next class", "up");
  await tick("Kevin Otieno");
  expect(summary()).toBe("1 learner ticked will each move up one grade.");
  await choose("Next class", "Grade 7");
  expect(summary()).toBe("1 learner ticked will move to Grade 7.");
  await act(async () => Simulate.click(button(/^Move 1 learner$/)));

  expect(onConfirm).toHaveBeenCalledWith({ learner_ids: [2], next_grade: "Grade 7" });

  await unmount();
});

test("nothing can be confirmed until someone is ticked and something changes", async () => {
  const { unmount, onConfirm } = await open();

  expect(summary()).toBe("Tick the learners who are moving.");
  expect(button(/^Move 0 learners$/).disabled).toBe(true);

  await tick("Anna Mani");
  await choose("Next term", "");
  expect(summary()).toBe("Choose a term, a class, or both.");
  expect(button(/^Move 1 learner$/).disabled).toBe(true);
  await act(async () => Simulate.click(button(/^Move 1 learner$/)));
  expect(onConfirm).not.toHaveBeenCalled();

  await unmount();
});

test("Clear ticks empties the selection", async () => {
  const { unmount } = await open();

  await tick("Anna Mani");
  await tick("Kevin Otieno");
  await act(async () => Simulate.click(button(/^Clear ticks$/)));

  expect(tickbox("Anna Mani").checked).toBe(false);
  expect(summary()).toBe("Tick the learners who are moving.");

  await unmount();
});

test("with no term set up it says what to do, and a class move still works", async () => {
  const { unmount } = await open({ academicTerms: [] });

  expect(document.body.textContent).toMatch(/No current or upcoming term is set up/);
  await tick("Anna Mani");
  await choose("Next class", "up");
  expect(button(/^Move 1 learner$/).disabled).toBe(false);

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
