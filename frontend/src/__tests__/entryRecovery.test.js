import { act } from "react-dom/test-utils";
import { reloadForNewVersion } from "../lib/staleBuild";

// The entry file runs as soon as it is loaded, so the page it starts on is set up
// first, in the state the host really sends it: the snapshot present and hidden.
let mockAppError = null;
jest.mock(
  "App",
  () =>
    function App() {
      if (mockAppError) throw mockAppError;
      return null;
    }
);
jest.mock("../lib/staleBuild", () => ({
  ...jest.requireActual("../lib/staleBuild"),
  reloadForNewVersion: jest.fn(),
}));

beforeAll(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML =
    '<div id="app" data-seo-snapshot="true" style="visibility:hidden"><main>snapshot</main></div>';
  await act(async () => {
    require("../index");
  });
});

const preloadError = () => new Event("vite:preloadError", { cancelable: true });

test("the hidden snapshot gives way to the app", () => {
  const app = document.getElementById("app");

  expect(app.dataset.seoSnapshot).toBeUndefined();
  expect(app.style.visibility).toBe("");
  expect(app.textContent).not.toContain("snapshot");
});

test("a screen whose file was replaced is answered by reloading, and its error is held back", () => {
  reloadForNewVersion.mockReset().mockReturnValue(true);
  const event = preloadError();

  window.dispatchEvent(event);

  expect(reloadForNewVersion).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test("when a reload was only just tried, the error is left to be shown", () => {
  reloadForNewVersion.mockReset().mockReturnValue(false);
  const event = preloadError();

  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(false);
});

test("if the app itself fails to draw, the page says so instead of going blank", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockAppError = new Error("Cannot read properties of undefined (reading 'user')");
  document.body.innerHTML =
    '<div id="app" data-seo-snapshot="true" style="visibility:hidden"><main>snapshot</main></div>';

  // A fresh copy of React along with a fresh entry file, and the act() that goes with it.
  jest.resetModules();
  const { act: actWithFreshReact } = require("react-dom/test-utils");
  await actWithFreshReact(async () => {
    require("../index");
  });

  const app = document.getElementById("app");
  expect(app.textContent).toMatch(/This page did not load properly/);
  expect(app.style.visibility).toBe("");
  mockAppError = null;
  console.error.mockRestore();
});
