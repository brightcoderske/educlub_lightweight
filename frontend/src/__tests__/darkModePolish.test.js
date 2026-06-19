import { readFileSync } from "fs";
import { resolve } from "path";

test("dark mode uses a softer eduClub night palette", () => {
  const source = readFileSync(resolve(__dirname, "../assets/theme-dark/base/colors.js"), "utf8");

  expect(source).toContain('default: "#0f172a"');
  expect(source).toContain('sidenav: "#111827"');
  expect(source).toContain('card: "#172033"');
  expect(source).toContain('main: "#38bdf8"');
});
