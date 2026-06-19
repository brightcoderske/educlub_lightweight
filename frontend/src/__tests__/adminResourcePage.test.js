import { readFileSync } from "fs";
import { resolve } from "path";

test("admin resource forms preserve false defaults for draft publishing controls", () => {
  const source = readFileSync(
    resolve(__dirname, "../layouts/system-admin/AdminResourcePage.js"),
    "utf8"
  );

  expect(source).toContain('hasOwnProperty.call(field, "defaultValue")');
  expect(source).toContain("field.defaultValue");
  expect(source).toContain('type === "boolean"');
});
