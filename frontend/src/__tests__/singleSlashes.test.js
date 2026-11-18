import { singleSlashAddress } from "lib/singleSlashes";

test("a doubled slash in a reset link is tidied, keeping the token", () => {
  expect(
    singleSlashAddress({
      pathname: "//authentication/set-password",
      search: "?token=abc123",
      hash: "",
    })
  ).toBe("/authentication/set-password?token=abc123");
});

test("slashes doubled anywhere in the path are tidied", () => {
  expect(singleSlashAddress({ pathname: "/learner//courses///5" })).toBe("/learner/courses/5");
});

test("an address that is already right is left alone", () => {
  expect(singleSlashAddress({ pathname: "/authentication/set-password", search: "?token=x" })).toBe(
    null
  );
});
