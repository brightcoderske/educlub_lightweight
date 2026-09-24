import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

// One screen failing must not blank the page. The real App is rendered over routes
// that fail or work on purpose, with a signed-in person so the sidebar is present.
jest.mock("assets/images/brand/educlub-logo.png", () => "logo.png");
jest.mock("components/IdleTimeoutGuard", () => () => null);
jest.mock("examples/Sidenav", () => {
  const React = require("react");
  const { useNavigate } = require("react-router-dom");
  return function Sidenav() {
    const navigate = useNavigate();
    return React.createElement(
      "nav",
      null,
      "Sidebar",
      React.createElement(
        "button",
        { type: "button", onClick: () => navigate("/working") },
        "Working page"
      )
    );
  };
});
jest.mock("routes", () => {
  const React = require("react");
  const Broken = () => {
    throw new Error("Cannot read properties of undefined (reading 'map')");
  };
  return [
    { key: "broken", route: "/broken", component: React.createElement(Broken) },
    {
      key: "working",
      route: "/working",
      component: React.createElement("p", null, "A working page"),
    },
    {
      key: "missing",
      route: "*",
      public: true,
      component: React.createElement("p", null, "Not found"),
    },
  ];
});

beforeEach(() => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("user", JSON.stringify({ id: 1, role: "school_admin", schoolId: 2 }));
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  localStorage.clear();
  console.error.mockRestore();
});

async function openAt(path) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test("a screen that fails is explained, and the rest of the page is still there", async () => {
  const { container, unmount } = await openAt("/broken");

  expect(container.textContent).toContain("Sidebar");
  expect(container.textContent).toMatch(/This page did not load properly/);
  expect(container.querySelector("button")).not.toBeNull();
  await unmount();
});

test("going to another screen from there works without reloading", async () => {
  const { container, unmount } = await openAt("/broken");

  const link = Array.from(container.querySelectorAll("button")).find((item) =>
    /Working page/.test(item.textContent)
  );
  await act(async () => Simulate.click(link));

  expect(container.textContent).toContain("A working page");
  expect(container.textContent).not.toMatch(/This page did not load properly/);
  await unmount();
});
