import React from "react";
import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../assets/theme";
import { MaterialUIControllerProvider } from "../context";
import MyTypingTutor from "../layouts/learner/typing-tutor";
import { buildTypingPracticePath } from "../layouts/learner/typing-tutor/practicePath";
import { apiClient } from "../lib/api";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, role: "learner" }, isLearner: () => true }),
}));
jest.mock("../lib/api", () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock(
  "../examples/LayoutContainers/DashboardLayout",
  () =>
    ({ children }) =>
      children
);
jest.mock("../examples/Navbars/DashboardNavbar", () => () => null);
jest.mock("../examples/Footer", () => () => null);
jest.mock("../layouts/learner/typing-tutor/typingSounds", () => ({
  isMuted: () => true,
  playAttemptSaved: jest.fn(),
  playError: jest.fn(),
  playKeyTick: jest.fn(),
  playSuccess: jest.fn(),
  playWordComplete: jest.fn(),
  setMuted: jest.fn(),
}));

test("a finished drill saves once, exposes save failures, and retries the original result before unlocking", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000000);
  apiClient.get.mockResolvedValue({ activities: [] });
  apiClient.post
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementationOnce(async (_, payload) => ({
      ...payload,
      id: 10,
      passed: true,
      net_wpm: 25,
      raw_wpm: 25,
      accuracy: 100,
      mistakes: 0,
      submitted_at: "2026-09-02T12:00:00Z",
    }));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const button = (label) =>
    [...container.querySelectorAll("button")].find((element) =>
      element.textContent.includes(label)
    );
  try {
    await act(async () =>
      root.render(
        <ThemeProvider theme={theme}>
          <MaterialUIControllerProvider>
            <MyTypingTutor />
          </MaterialUIControllerProvider>
        </ThemeProvider>
      )
    );
    await act(async () => button("Start Practice").click());
    const passage = buildTypingPracticePath()[0].levels[0].activities[0].text;
    const input = container.querySelector("textarea");
    await act(async () => Simulate.change(input, { target: { value: passage[0] } }));
    expect(apiClient.post).not.toHaveBeenCalled();
    clock.mockReturnValue(1030000);
    await act(async () => Simulate.change(input, { target: { value: passage } }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post.mock.calls[0][1]).toMatchObject({
      typed_text: passage,
      duration_seconds: 30,
    });
    expect(container.textContent).toContain("Your attempt has not saved yet");
    expect(button("Next Activity").disabled).toBe(true);
    clock.mockReturnValue(1100000);
    await act(async () => button("Save again").click());
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(apiClient.post.mock.calls[1][1]).toEqual(apiClient.post.mock.calls[0][1]);
    expect(button("Next Activity").disabled).toBe(false);
    expect(container.textContent).toContain("saved for your teacher");
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    clock.mockRestore();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
