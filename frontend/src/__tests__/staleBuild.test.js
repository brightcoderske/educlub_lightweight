import { isMissingFileError, reloadForNewVersion } from "../lib/staleBuild";

// A page opened before a release asks for screens whose files the release replaced.
// These are the two decisions made about it: is this that, and may we reload for it.

const GONE = "https://www.educlub.co.ke/assets/sign-in-B03vaS0g.js";

test.each([
  ["Chrome", `Failed to fetch dynamically imported module: ${GONE}`],
  ["Firefox", `error loading dynamically imported module: ${GONE}`],
  ["Safari", "Importing a module script failed."],
  ["Vite, for a stylesheet", "Unable to preload CSS for /assets/learners-Abc123.css"],
])("%s's wording for a screen whose file is gone is recognised", (_browser, message) => {
  expect(isMissingFileError(new TypeError(message))).toBe(true);
});

test("every other failure is left alone, so a real bug is never hidden behind a reload", () => {
  expect(
    isMissingFileError(new TypeError("Cannot read properties of undefined (reading 'map')"))
  ).toBe(false);
  expect(isMissingFileError(new Error("Failed to create learner"))).toBe(false);
  expect(isMissingFileError(new Error(""))).toBe(false);
  expect(isMissingFileError(null)).toBe(false);
  expect(isMissingFileError(undefined)).toBe(false);
});

test("something thrown as plain text is read as well", () => {
  expect(isMissingFileError(`Failed to fetch dynamically imported module: ${GONE}`)).toBe(true);
});

const memoryStorage = () => {
  const values = {};
  return {
    getItem: (key) => (key in values ? values[key] : null),
    setItem: (key, value) => {
      values[key] = String(value);
    },
  };
};

test("the first time, the page is reloaded", () => {
  const reload = jest.fn();

  expect(reloadForNewVersion({ now: 1_000_000, storage: memoryStorage(), reload })).toBe(true);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("a second failure straight after is a real fault, so it is not reloaded again", () => {
  const storage = memoryStorage();
  const reload = jest.fn();

  reloadForNewVersion({ now: 1_000_000, storage, reload });
  const again = reloadForNewVersion({ now: 1_010_000, storage, reload });

  expect(again).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("a later release can be reloaded for once the wait has passed", () => {
  const storage = memoryStorage();
  const reload = jest.fn();

  reloadForNewVersion({ now: 1_000_000, storage, reload });
  const later = reloadForNewVersion({ now: 1_031_000, storage, reload });

  expect(later).toBe(true);
  expect(reload).toHaveBeenCalledTimes(2);
});

test("with nowhere to remember it, it does not reload, because it could never stop", () => {
  const reload = jest.fn();
  const blocked = {
    getItem: () => {
      throw new Error("The operation is insecure.");
    },
    setItem: () => {
      throw new Error("The operation is insecure.");
    },
  };

  expect(reloadForNewVersion({ storage: blocked, reload })).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});

test("it uses the tab's own session storage unless told otherwise", () => {
  window.sessionStorage.clear();
  const reload = jest.fn();

  expect(reloadForNewVersion({ reload })).toBe(true);
  expect(reloadForNewVersion({ reload })).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);

  window.sessionStorage.clear();
});
