import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import AppErrorBoundary from "../components/AppErrorBoundary";
import { reloadForNewVersion } from "../lib/staleBuild";

jest.mock("../lib/staleBuild", () => ({
  ...jest.requireActual("../lib/staleBuild"),
  reloadForNewVersion: jest.fn(),
}));

// Rendered with no theme and none of the app's providers: the message has to
// draw even when those are what failed.
async function mount(element) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    show: (next) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const Broken = ({ message }) => {
  throw new Error(message);
};
const GONE =
  "Failed to fetch dynamically imported module: https://www.educlub.co.ke/assets/sign-in-B03vaS0g.js";
const button = (container) => container.querySelector("button");
const loggedByUs = () =>
  console.error.mock.calls.filter(([first]) => first === "A page could not be shown:");

beforeEach(() => {
  reloadForNewVersion.mockReset();
  // React reports a caught error to the console itself; keep that out of the output.
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

test("a screen that works is drawn as it is", async () => {
  const { container, unmount } = await mount(
    <AppErrorBoundary>
      <p>Learners</p>
    </AppErrorBoundary>
  );

  expect(container.textContent).toBe("Learners");
  await unmount();
});

test("a screen that fails becomes a message and a way out, not a blank page", async () => {
  const onReload = jest.fn();
  const { container, unmount } = await mount(
    <AppErrorBoundary onReload={onReload}>
      <Broken message="Cannot read properties of undefined (reading 'map')" />
    </AppErrorBoundary>
  );

  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).toMatch(/This page did not load properly/);
  expect(container.textContent).toMatch(/tell your school admin or eduClub support/);
  expect(container.querySelector("details").textContent).toContain(
    "Cannot read properties of undefined (reading 'map')"
  );

  await act(async () => Simulate.click(button(container)));
  expect(onReload).toHaveBeenCalledTimes(1);
  await unmount();
});

test("an ordinary failure is written to the console and never reloaded for", async () => {
  const { unmount } = await mount(
    <AppErrorBoundary>
      <Broken message="boom" />
    </AppErrorBoundary>
  );

  expect(loggedByUs()).toHaveLength(1);
  expect(reloadForNewVersion).not.toHaveBeenCalled();
  await unmount();
});

test("a screen whose file a new release replaced is reloaded for, once, without asking", async () => {
  reloadForNewVersion.mockReturnValue(true);
  const { container, unmount } = await mount(
    <AppErrorBoundary>
      <Broken message={GONE} />
    </AppErrorBoundary>
  );

  expect(reloadForNewVersion).toHaveBeenCalledTimes(1);
  expect(loggedByUs()).toHaveLength(0);
  expect(container.textContent).toMatch(/eduClub has just been updated/);
  expect(container.textContent).toMatch(/Reload to open the new version/);
  await unmount();
});

test("if that reload was just tried, it says so and lets the person reload, instead of looping", async () => {
  reloadForNewVersion.mockReturnValue(false);
  const onReload = jest.fn();
  const { container, unmount } = await mount(
    <AppErrorBoundary onReload={onReload}>
      <Broken message={GONE} />
    </AppErrorBoundary>
  );

  expect(container.textContent).toMatch(/eduClub has just been updated/);
  expect(loggedByUs()).toHaveLength(1);
  await act(async () => Simulate.click(button(container)));
  expect(onReload).toHaveBeenCalledTimes(1);
  await unmount();
});

test("moving to another screen tries again, and staying put does not", async () => {
  const { container, show, unmount } = await mount(
    <AppErrorBoundary resetKey="/school-admin/learners">
      <Broken message="boom" />
    </AppErrorBoundary>
  );
  expect(container.textContent).toMatch(/This page did not load properly/);

  await show(
    <AppErrorBoundary resetKey="/school-admin/learners">
      <p>Learners</p>
    </AppErrorBoundary>
  );
  expect(container.textContent).toMatch(/This page did not load properly/);

  await show(
    <AppErrorBoundary resetKey="/school-admin/allocations">
      <p>Allocations</p>
    </AppErrorBoundary>
  );
  expect(container.textContent).toBe("Allocations");
  await unmount();
});
