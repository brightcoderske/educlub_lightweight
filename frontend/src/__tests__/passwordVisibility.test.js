import { readFileSync } from "fs";
import { resolve } from "path";

test("sign in and password reset screens use visibility controls", () => {
  const passwordField = readFileSync(
    resolve(__dirname, "../components/PasswordField/index.js"),
    "utf8"
  );
  expect(passwordField).toContain("visibility_off");
  expect(passwordField).toContain("Show password");

  [
    "../layouts/authentication/sign-in/index.js",
    "../layouts/authentication/reset-password/index.js",
    "../layouts/authentication/set-password/index.js",
  ].forEach((file) => {
    expect(readFileSync(resolve(__dirname, file), "utf8")).toContain("PasswordField");
  });
});
