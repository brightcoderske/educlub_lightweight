import React from "react";
import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import theme from "../assets/theme";
import { MaterialUIControllerProvider } from "../context";
import LearnerProfile from "../layouts/learner/profile";
import { apiClient } from "../lib/api";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 9, role: "learner", email: "annamani@learners.educlub.local", full_name: "Anna Mani" },
    isLearner: () => true,
    resetPassword: jest.fn(),
    updateProfilePhoto: jest.fn(),
  }),
}));
jest.mock("../lib/api", () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}));
jest.mock(
  "../examples/LayoutContainers/DashboardLayout",
  () =>
    ({ children }) =>
      children
);
jest.mock("../examples/Navbars/DashboardNavbar", () => () => null);
jest.mock("../examples/Footer", () => () => null);

// A learner account is created with a generated @learners.educlub.local
// address. Nothing reaches it, so until a learner can replace it themselves a
// forgotten password needs an administrator.
test("a learner can replace the placeholder address their account was created with", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  apiClient.get.mockResolvedValue([
    { id: 4, full_name: "Anna Mani", email: "annamani@learners.educlub.local", grade: "Grade 5" },
  ]);
  apiClient.put.mockResolvedValue({
    id: 4,
    full_name: "Anna Mani",
    email: "anna.mani@gmail.com",
    grade: "Grade 5",
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <MaterialUIControllerProvider>
          <ThemeProvider theme={theme}>
            <LearnerProfile />
          </ThemeProvider>
        </MaterialUIControllerProvider>
      </MemoryRouter>
    );
  });

  const emailInput = Array.from(container.querySelectorAll("input")).find(
    (input) => input.value === "annamani@learners.educlub.local"
  );
  expect(emailInput).toBeTruthy();

  await act(async () => {
    Simulate.change(emailInput, { target: { value: "anna.mani@gmail.com" } });
  });

  const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
    /save my email/i.test(button.textContent)
  );
  expect(saveButton).toBeTruthy();

  await act(async () => {
    Simulate.click(saveButton);
  });

  expect(apiClient.put).toHaveBeenCalledWith("/learners/4", { email: "anna.mani@gmail.com" });
  expect(container.textContent).toMatch(/Your email address is saved/i);

  await act(async () => root.unmount());
  container.remove();
});
