import { act, Simulate } from "react-dom/test-utils";
import SchoolAdminLearners from "../layouts/school-admin/learners";
import { apiClient } from "../lib/api";
import { printCredentialCard } from "../lib/printCredentialCard";
import { renderInApp } from "../testRender";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { schoolId: 2 }, isSchoolAdmin: () => true }),
}));
jest.mock("../lib/api", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("../lib/printCredentialCard", () => ({ printCredentialCard: jest.fn() }));
jest.mock("read-excel-file", () => jest.fn());
jest.mock("../components/LearnerDetailModal", () => () => null);
jest.mock(
  "../examples/LayoutContainers/DashboardLayout",
  () =>
    ({ children }) =>
      children
);
jest.mock(
  "../examples/Navbars/DashboardNavbar",
  () =>
    ({ actions }) =>
      actions
);
jest.mock("../examples/Footer", () => () => null);

// The two things an admin does on this page that hand something over: adding a
// learner, whose sign-in details must be given to them, and moving a class on to
// its next term.
const iso = (offsetDays) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const YEAR = new Date().getFullYear();
const TERMS = [
  {
    name: "Term A",
    academic_year: YEAR,
    start_date: iso(-30),
    end_date: iso(30),
    term_type: "regular",
  },
  {
    name: "Term B",
    academic_year: YEAR,
    start_date: iso(60),
    end_date: iso(150),
    term_type: "regular",
  },
];
const LEARNERS = [
  { id: 1, full_name: "Anna Mani", grade: "Grade 5", stream: "A", graduation_status: "active" },
  { id: 2, full_name: "Kevin Otieno", grade: "Grade 5", stream: "A", graduation_status: "active" },
];
const CREATED = {
  learner: { id: 9, full_name: "Floyed Muchiri", grade: "Grade 5", stream: "A" },
  user: { id: 30, username: "floyedmuchiri" },
  username: "floyedmuchiri",
  plainPassword: "Welcome-1234",
};

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockImplementation(async (url) => {
    if (url.startsWith("/learners")) return LEARNERS;
    if (url.startsWith("/schools/")) {
      return {
        id: 2,
        name: "BRIGHT CODERS",
        grades_config: ["Grade 5", "Grade 6"],
        streams_config: ["A"],
      };
    }
    if (url === "/academic/terms") return TERMS;
    return [];
  });
});

const button = (pattern) =>
  Array.from(document.body.querySelectorAll("button")).find((item) =>
    pattern.test(item.textContent)
  );
const inputFor = (label) => {
  const found = Array.from(document.body.querySelectorAll("label")).find((item) =>
    item.textContent.trim().startsWith(label)
  );
  return document.getElementById(found.htmlFor);
};
const type = (label, value) =>
  act(async () => Simulate.change(inputFor(label), { target: { value } }));

test("adding a learner shows their username and password, and can print their card", async () => {
  apiClient.post.mockResolvedValue(CREATED);
  const { unmount } = await renderInApp(<SchoolAdminLearners />);

  await act(async () => Simulate.click(button(/person_add/)));
  await type("First Name", "Floyed");
  await type("Second Name", "Muchiri");
  await act(async () => Simulate.click(button(/^Add Learner$/)));

  expect(apiClient.post).toHaveBeenCalledWith(
    "/learners",
    expect.objectContaining({ first_name: "Floyed", second_name: "Muchiri" })
  );
  const text = document.body.textContent;
  expect(text).toMatch(/Learner created/);
  expect(text).toContain("floyedmuchiri");
  expect(text).toContain("Welcome-1234");

  await act(async () => Simulate.click(button(/print card/i)));

  expect(printCredentialCard).toHaveBeenCalledWith(
    expect.objectContaining({
      fullName: "Floyed Muchiri",
      schoolName: "BRIGHT CODERS",
      grade: "Grade 5",
      stream: "A",
      username: "floyedmuchiri",
      password: "Welcome-1234",
    })
  );

  // Done puts the popup away; the details are not kept on screen.
  await act(async () => Simulate.click(button(/^Done$/)));
  expect(document.body.textContent).not.toMatch(/Learner created/);

  await unmount();
});

test("a learner who could not be created gets no popup", async () => {
  apiClient.post.mockRejectedValue(new Error("Failed to create learner"));
  const { unmount } = await renderInApp(<SchoolAdminLearners />);

  await act(async () => Simulate.click(button(/person_add/)));
  await type("First Name", "Floyed");
  await type("Second Name", "Muchiri");
  await act(async () => Simulate.click(button(/^Add Learner$/)));

  expect(document.body.textContent).not.toMatch(/Learner created/);
  expect(printCredentialCard).not.toHaveBeenCalled();

  await unmount();
});

test("Bulk Graduate asks for the next term and moves the class into it", async () => {
  apiClient.post.mockResolvedValue({ message: "Moved 2 learners to Term B " + YEAR + "." });
  const { unmount } = await renderInApp(<SchoolAdminLearners />);

  await act(async () => Simulate.click(button(/Bulk Graduate/)));

  expect(document.body.textContent).toMatch(/Graduate learners to the next term/);
  expect(document.body.textContent).toMatch(/1\. Which term are they moving to\?/);

  await act(async () => Simulate.click(button(/^Graduate 2 learners$/)));

  expect(apiClient.post).toHaveBeenCalledWith("/learners/promote", {
    next_term: "Term B",
    academic_year: YEAR,
  });
  // The dialog is put away, and what it did is left on the page where it can be read.
  expect(document.body.textContent).not.toMatch(/Graduate learners to the next term/);
  const notice = document.body.querySelector('[role="alert"]');
  expect(notice.textContent).toBe(`Moved 2 learners to Term B ${YEAR}.`);

  // It belongs to the page, not to the Bulk Upload dialog, and can be dismissed.
  await act(async () => Simulate.click(button(/upload_file/)));
  expect(document.body.textContent.split(`Moved 2 learners`).length - 1).toBe(1);
  await act(async () => Simulate.click(button(/^Close$/)));
  await act(async () =>
    Simulate.click(document.body.querySelector('[role="alert"] [aria-label="Close"]'))
  );
  expect(document.body.querySelector('[role="alert"]')).toBeNull();

  await unmount();
});

test("a failed graduation is explained inside the dialog and leaves it open", async () => {
  apiClient.post.mockRejectedValue(new Error('Term "Term B" does not exist.'));
  const { unmount } = await renderInApp(<SchoolAdminLearners />);

  await act(async () => Simulate.click(button(/Bulk Graduate/)));
  await act(async () => Simulate.click(button(/^Graduate 2 learners$/)));

  expect(document.body.textContent).toMatch(/Graduate learners to the next term/);
  expect(document.body.textContent).toContain('Term "Term B" does not exist.');

  await unmount();
});
