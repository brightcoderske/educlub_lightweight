import React from "react";
import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../assets/theme";
import { MaterialUIControllerProvider } from "../context";
import SchoolAdminLearners from "../layouts/school-admin/learners";
import { setCachedPage, clearCachedPage } from "../lib/pageCache";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { schoolId: 7, role: "school_admin" }, isSchoolAdmin: () => true }),
}));
jest.mock("../lib/api", () => ({ apiClient: { get: jest.fn(() => new Promise(() => {})) } }));
jest.mock(
  "../examples/LayoutContainers/DashboardLayout",
  () =>
    ({ children }) =>
      children
);
jest.mock("../examples/Navbars/DashboardNavbar", () => () => null);
jest.mock("../examples/Footer", () => () => null);
jest.mock("../components/LearnerDetailModal", () => () => null);

test("cached learners render immediately and all 226 rows remain reachable through paging and filters", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const learners = Array.from({ length: 226 }, (_, index) => ({
    id: index + 1,
    full_name: `Learner ${String(index + 1).padStart(3, "0")}`,
    grade: "Grade 4",
    stream: "A",
    school_id: 7,
  }));
  setCachedPage("school-admin:7:learners", {
    learners,
    school: { grades_config: ["Grade 4"], streams_config: ["A"] },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <ThemeProvider theme={theme}>
          <MaterialUIControllerProvider>
            <SchoolAdminLearners />
          </MaterialUIControllerProvider>
        </ThemeProvider>
      )
    );
    const rows = () => [...container.querySelectorAll("tbody tr")];
    expect(rows()).toHaveLength(20);
    expect(container.textContent).not.toContain("Loading learners...");
    expect(rows()[0].textContent).toContain("Learner 001");
    await act(async () => container.querySelector('[aria-label="Go to next page"]').click());
    expect(rows()[0].textContent).toContain("Learner 021");
    await act(async () => container.querySelector('[aria-label="Go to last page"]').click());
    expect(rows()).toHaveLength(6);
    expect(rows()[5].textContent).toContain("Learner 226");
    const label = [...container.querySelectorAll("label")].find(
      (item) => item.textContent === "Search"
    );
    const input = document.getElementById(label.htmlFor);
    await act(async () => Simulate.change(input, { target: { value: "Learner 001" } }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Learner 001");
    await act(async () => Simulate.change(input, { target: { value: "No match" } }));
    expect(container.textContent).toContain("No learners match these filters.");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    clearCachedPage("school-admin:7:learners");
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
