import { learnerChatWording, senderLabel } from "lib/feedbackChat";

it("a school learner writes to their own school, not to eduClub", () => {
  const wording = learnerChatWording({ independent: false, school_name: "Kba School " });
  expect(wording.title).toBe("Message Kba School");
  expect(wording.intro).toMatch(/teacher or school admin/);
  expect(wording.intro).not.toMatch(/eduClub/);
});

it("an independent learner, who has no school staff, writes to eduClub", () => {
  expect(
    learnerChatWording({ independent: true, school_name: "eduClub Independent Learners" }).title
  ).toBe("Message eduClub");
});

it("replies say who sent them", () => {
  expect(senderLabel("teacher")).toBe("Teacher");
  expect(senderLabel("school_admin")).toBe("School admin");
  expect(senderLabel("system_admin")).toBe("eduClub");
  expect(senderLabel("unknown")).toBe("");
});
