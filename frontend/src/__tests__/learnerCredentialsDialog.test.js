import { act, Simulate } from "react-dom/test-utils";
import LearnerCredentialsDialog, {
  credentialsFromCreatedLearner,
} from "../components/LearnerCredentialsDialog";
import { printCredentialCard } from "../lib/printCredentialCard";
import { renderInApp } from "../testRender";

jest.mock("../lib/printCredentialCard", () => ({ printCredentialCard: jest.fn() }));

const CREATED = {
  learner: { id: 21, full_name: "Floyed Muchiri", grade: "Grade 5", stream: null },
  user: { id: 11, username: "floyedmuchiri" },
  username: "floyedmuchiri",
  plainPassword: "Welcome-1234",
};

const button = (label) =>
  Array.from(document.body.querySelectorAll("button")).find((item) => label.test(item.textContent));

beforeEach(() => printCredentialCard.mockClear());

test("what the create call returns becomes the details to hand over", () => {
  expect(credentialsFromCreatedLearner(CREATED, "BRIGHT CODERS")).toEqual({
    fullName: "Floyed Muchiri",
    schoolName: "BRIGHT CODERS",
    grade: "Grade 5",
    stream: "",
    username: "floyedmuchiri",
    password: "Welcome-1234",
    signInUrl: `${window.location.origin}/authentication/sign-in`,
  });
});

test("nothing is shown until a learner has been created", async () => {
  const { unmount } = await renderInApp(
    <LearnerCredentialsDialog credentials={null} onClose={() => {}} />
  );

  expect(document.body.textContent).not.toMatch(/Learner created/);

  await unmount();
});

test("the popup shows the username and the temporary password", async () => {
  const credentials = credentialsFromCreatedLearner(CREATED, "BRIGHT CODERS");
  const { unmount } = await renderInApp(
    <LearnerCredentialsDialog credentials={credentials} onClose={() => {}} />
  );

  const text = document.body.textContent;
  expect(text).toMatch(/Learner created/);
  expect(text).toMatch(/Floyed Muchiri can sign in with these details/);
  expect(text).toContain("floyedmuchiri");
  expect(text).toContain("Welcome-1234");
  expect(text).toMatch(/choose a new password the first time/);

  await unmount();
});

test("Print card prints this learner's card, and only theirs", async () => {
  const credentials = credentialsFromCreatedLearner(CREATED, "BRIGHT CODERS");
  const { unmount } = await renderInApp(
    <LearnerCredentialsDialog credentials={credentials} onClose={() => {}} />
  );

  await act(async () => Simulate.click(button(/print card/i)));

  expect(printCredentialCard).toHaveBeenCalledTimes(1);
  expect(printCredentialCard).toHaveBeenCalledWith(credentials);

  await unmount();
});

test("Done closes it without printing", async () => {
  const onClose = jest.fn();
  const credentials = credentialsFromCreatedLearner(CREATED, "BRIGHT CODERS");
  const { unmount } = await renderInApp(
    <LearnerCredentialsDialog credentials={credentials} onClose={onClose} />
  );

  await act(async () => Simulate.click(button(/^done$/i)));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(printCredentialCard).not.toHaveBeenCalled();

  await unmount();
});
