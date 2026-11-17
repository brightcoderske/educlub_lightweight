import { coverageColor, openedShare } from "lib/activityCoverage";

describe("openedShare", () => {
  test("uses the opened count, not the mark", () => {
    const module = {
      total_activities: 10,
      opened_activities: 2,
      opened_percent: 20,
      completed_activities: 1,
      score_percent: 100,
    };
    expect(openedShare(module)).toEqual({ opened: 2, total: 10, percent: 20 });
  });

  test("works out the percent when only the counts are given", () => {
    expect(openedShare({ total_activities: 7, opened_activities: 4 })).toEqual({
      opened: 4,
      total: 7,
      percent: 57,
    });
  });

  test("falls back to completed activities for progress saved before opened counts", () => {
    expect(openedShare({ total_activities: 4, completed_activities: 3 })).toEqual({
      opened: 3,
      total: 4,
      percent: 75,
    });
  });

  test("a missing module or an empty one is 0", () => {
    expect(openedShare(undefined)).toEqual({ opened: 0, total: 0, percent: 0 });
    expect(openedShare({ total_activities: 0, opened_activities: 0 }).percent).toBe(0);
  });
});

describe("coverageColor", () => {
  test("grey, red, orange, blue, then green when everything is opened", () => {
    expect(coverageColor(0)).toBe("secondary");
    expect(coverageColor(20)).toBe("error");
    expect(coverageColor(57)).toBe("warning");
    expect(coverageColor(90)).toBe("info");
    expect(coverageColor(100)).toBe("success");
  });
});
