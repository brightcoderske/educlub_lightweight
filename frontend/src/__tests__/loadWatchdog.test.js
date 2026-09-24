import { readFileSync } from "fs";
import { resolve } from "path";

const { buildSnapshotHtml } = require("../../scripts/generate-public-seo");
const { PUBLIC_PAGES } = require("../layouts/public-site/publicPages");

// Every page is sent with the app hidden until src/index.js shows it. When that
// script never arrives, the inline watchdog in index.html is all that runs. It is
// tested by running the real script from the real file.
const template = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
const WATCHDOG = /<script id="educlub-load-watchdog">([\s\S]*?)<\/script>/;

const SNAPSHOT =
  '<div id="app" data-seo-snapshot="true" style="visibility:hidden"><main>snapshot</main></div>';
const app = () => document.getElementById("app");
const message = () => app().querySelector('[role="alert"]');

let listeners = [];

function startWatchdog() {
  document.body.innerHTML = SNAPSHOT;
  const add = window.addEventListener.bind(window);
  jest.spyOn(window, "addEventListener").mockImplementation((...args) => {
    listeners.push(args);
    add(...args);
  });
  new Function(template.match(WATCHDOG)[1])();
  window.addEventListener.mockRestore();
}

function scriptFailsToLoad() {
  const script = document.createElement("script");
  document.head.appendChild(script);
  script.dispatchEvent(new Event("error"));
  script.remove();
}

beforeEach(() => {
  jest.useFakeTimers();
  listeners = [];
});
afterEach(() => {
  listeners.forEach(([type, handler, options]) =>
    window.removeEventListener(type, handler, options)
  );
  jest.clearAllTimers();
  jest.useRealTimers();
  document.body.innerHTML = "";
});

test("the watchdog is in the page, ahead of the app's own script", () => {
  expect(template).toMatch(WATCHDOG);
  expect(template.indexOf('id="educlub-load-watchdog"')).toBeLessThan(
    template.indexOf('<script type="module"')
  );
});

test("every page built from the template carries it", () => {
  const page = buildSnapshotHtml(
    template,
    "/courses/python-programming",
    PUBLIC_PAGES["/courses/python-programming"]
  );

  expect(page).toMatch(WATCHDOG);
  expect(page).toContain('style="visibility:hidden"');
});

test("while the app is still on its way, the page is left alone", () => {
  startWatchdog();

  jest.advanceTimersByTime(11_999);

  expect(message()).toBeNull();
  expect(app().style.visibility).toBe("hidden");
});

test("if the app's script fails to load, the person is told at once and can reload", () => {
  startWatchdog();

  scriptFailsToLoad();

  expect(message().textContent).toMatch(/taking longer than usual to load/);
  expect(message().textContent).toMatch(/Check your internet connection/);
  expect(message().querySelector("button").textContent).toBe("Reload page");
  expect(app().style.visibility).toBe("");
  expect(app().textContent).not.toContain("snapshot");
});

test("if it simply has not arrived after twelve seconds, the person is told", () => {
  startWatchdog();

  jest.advanceTimersByTime(12_000);

  expect(message()).not.toBeNull();
  expect(app().style.visibility).toBe("");
});

test("the message is drawn once, however many things fail", () => {
  startWatchdog();

  scriptFailsToLoad();
  scriptFailsToLoad();
  jest.advanceTimersByTime(12_000);

  expect(app().querySelectorAll('[role="alert"]')).toHaveLength(1);
});

test("nothing is said once the app has started, whatever fails after that", () => {
  startWatchdog();
  // What src/index.js does when it takes over.
  app().innerHTML = "";
  app().style.visibility = "";
  delete app().dataset.seoSnapshot;

  scriptFailsToLoad();
  jest.advanceTimersByTime(60_000);

  expect(message()).toBeNull();
});

test("a failing image or stylesheet is not mistaken for the app failing", () => {
  startWatchdog();

  const image = document.createElement("img");
  document.body.appendChild(image);
  image.dispatchEvent(new Event("error"));

  expect(message()).toBeNull();
});

test("the app can still take over after the message has been shown", () => {
  startWatchdog();
  jest.advanceTimersByTime(12_000);
  expect(message()).not.toBeNull();

  // The snapshot attribute is left in place so src/index.js still clears the message.
  expect(app().dataset.seoSnapshot).toBe("true");
});
