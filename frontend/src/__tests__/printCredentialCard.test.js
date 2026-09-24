import { buildCredentialCard, printCredentialCard } from "../lib/printCredentialCard";

const CARD = {
  fullName: "Floyed Muchiri",
  schoolName: "BRIGHT CODERS",
  grade: "Grade 5",
  stream: "A",
  username: "floyedmuchiri",
  password: "Welcome-1234",
  signInUrl: "https://educlub.co.ke/authentication/sign-in",
};

const blankDocument = () => document.implementation.createHTMLDocument("");
const lines = (doc) =>
  Array.from(doc.querySelectorAll(".card > div")).map((node) => node.textContent);

afterEach(() => {
  document.querySelectorAll("iframe").forEach((frame) => frame.remove());
  jest.useRealTimers();
});

test("the card carries everything the learner needs to sign in", () => {
  const doc = blankDocument();

  buildCredentialCard(doc, CARD);

  expect(lines(doc)).toEqual([
    "eduClub LMS",
    "https://educlub.co.ke/authentication/sign-in",
    "BRIGHT CODERS",
    "Name: Floyed Muchiri",
    "Grade: Grade 5",
    "Stream: A",
    "Username: floyedmuchiri",
    "Password: Welcome-1234",
    "First login will ask the learner to reset the password and complete missing profile details.",
  ]);
  expect(doc.title).toBe("Login card - Floyed Muchiri");
});

test("details that were not given are left off rather than printed blank", () => {
  const doc = blankDocument();

  buildCredentialCard(doc, { fullName: "Anna Mani", username: "annamani", password: "pw" });

  const text = lines(doc).join("\n");
  expect(text).not.toMatch(/Grade:|Stream:|http/);
  expect(text).toContain("Username: annamani");
});

// A learner's name is typed by a person, so it is only ever put on the card as text.
test("a name that looks like markup is printed as it is written, never run", () => {
  const doc = blankDocument();

  buildCredentialCard(doc, { ...CARD, fullName: '<img src=x onerror="alert(1)">' });

  expect(doc.querySelector("img")).toBeNull();
  expect(doc.querySelector(".card").textContent).toContain('Name: <img src=x onerror="alert(1)">');
});

test("printing opens the browser's own print dialog on a hidden frame holding the card", () => {
  const print = jest.fn((frameWindow) => {
    const frame = document.querySelector("iframe");
    expect(frame.contentWindow).toBe(frameWindow);
    expect(frameWindow.document.body.textContent).toContain("Username: floyedmuchiri");
  });

  printCredentialCard(CARD, { print });

  expect(print).toHaveBeenCalledTimes(1);
  expect(document.querySelector("iframe").getAttribute("aria-hidden")).toBe("true");
});

test("the frame goes away once the browser says printing is over", () => {
  printCredentialCard(CARD, { print: () => {} });
  const frame = document.querySelector("iframe");

  frame.contentWindow.dispatchEvent(new Event("afterprint"));

  expect(document.querySelector("iframe")).toBeNull();
});

test("and goes away anyway, later, for browsers that never say so", () => {
  jest.useFakeTimers();
  printCredentialCard(CARD, { print: () => {} });

  jest.advanceTimersByTime(60 * 1000);
  expect(document.querySelector("iframe")).not.toBeNull();

  jest.advanceTimersByTime(90 * 1000);
  expect(document.querySelector("iframe")).toBeNull();
});
