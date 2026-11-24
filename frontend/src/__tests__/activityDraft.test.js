import {
  chooseRestoredWork,
  draftStorageKey,
  readLocalDraft,
  sameWork,
  submissionToWork,
} from "layouts/learner/module-learn/activityDraft";
import { starterWorkspace } from "layouts/learner/module-learn/activityContent";

describe("which saved work an activity opens with", () => {
  const draft = { content: { code: "print('server')" }, revision: 4 };
  const submission = { content: { text: "print('submitted')", html: null } };

  it("prefers the server draft", () => {
    expect(chooseRestoredWork({ draft, submission, activityType: "coding" })).toMatchObject({
      work: { code: "print('server')" },
      revision: 4,
      source: "draft",
    });
  });

  it("uses this browser's copy when it never reached the server", () => {
    const local = { content: { code: "print('typed offline')" }, baseRevision: 4 };
    expect(chooseRestoredWork({ local, draft, activityType: "coding" })).toMatchObject({
      work: { code: "print('typed offline')" },
      revision: 4,
      unsent: true,
    });
  });

  it("ignores a browser copy older than newer work saved elsewhere", () => {
    const local = { content: { code: "print('stale')" }, baseRevision: 2 };
    expect(chooseRestoredWork({ local, draft, activityType: "coding" }).source).toBe("draft");
  });

  it("falls back to the last submission, mapped onto the editors", () => {
    expect(chooseRestoredWork({ submission, activityType: "coding" })).toMatchObject({
      work: { code: "print('submitted')" },
      source: "submission",
    });
    expect(submissionToWork({ text: "My answer", html: "<p>" }, "reflection")).toEqual({
      text: "My answer",
    });
  });

  it("opens with the starter code when nothing was saved", () => {
    expect(chooseRestoredWork({ activityType: "coding" })).toBeNull();
  });
});

describe("the copy kept in this browser", () => {
  it("is scoped to one learner and one activity", () => {
    expect(draftStorageKey(12, 340)).toBe("educlub-draft:12:340");
  });

  it("reads nothing back from blocked or corrupt storage", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readLocalDraft(1, 2, throwing)).toBeNull();
    expect(readLocalDraft(1, 2, { getItem: () => "{not json" })).toBeNull();
  });
});

it("treats a missing field as empty when comparing work", () => {
  expect(sameWork({ code: "", text: "" }, {})).toBe(true);
  expect(sameWork({ code: "a" }, { code: "b" })).toBe(false);
});

it("starts every editor from the activity's starter content", () => {
  expect(
    starterWorkspace({
      starter_html: "<h1>Hi</h1>",
      starter_css: "h1{}",
      starter_js: "",
    })
  ).toEqual({
    code: "<h1>Hi</h1>\n<style>\nh1{}\n</style>",
    html: "<h1>Hi</h1>",
    css: "h1{}",
    js: "",
  });
});
