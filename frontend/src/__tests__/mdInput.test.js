import MDInput from "../components/MDInput";
import { renderInApp } from "../testRender";

// `disabled` used to reach only the styling, so a field marked disabled looked
// it and could still be typed into. Nine fields across the app rely on it.
const inputOf = (label) => {
  const found = Array.from(document.body.querySelectorAll("label")).find((item) =>
    item.textContent.trim().startsWith(label)
  );
  return document.getElementById(found.htmlFor);
};

test("a disabled field is really disabled, not just drawn that way", async () => {
  const { unmount } = await renderInApp(<MDInput label="Term" disabled value="Term 3" />);

  expect(inputOf("Term").disabled).toBe(true);

  await unmount();
});

test("a select is disabled the same way", async () => {
  const { unmount } = await renderInApp(
    <MDInput select label="Grade" disabled value="" SelectProps={{ native: true }}>
      <option value="">Any grade</option>
    </MDInput>
  );

  expect(inputOf("Grade").disabled).toBe(true);

  await unmount();
});

test("an ordinary field is left alone", async () => {
  const { unmount } = await renderInApp(<MDInput label="Name" value="Anna" onChange={() => {}} />);

  expect(inputOf("Name").disabled).toBe(false);

  await unmount();
});
