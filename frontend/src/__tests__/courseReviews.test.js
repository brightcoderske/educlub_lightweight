import {
  buildReportQuery,
  canRevealIdentity,
  getRatingPresentation,
  getRatingDistribution,
  getRatingPercent,
  reportMatchesMode,
} from "../layouts/course-reviews/reportUtils";

describe("course review presentation", () => {
  test("classifies rating attention levels consistently", () => {
    expect(getRatingPresentation(4.5)).toEqual({
      label: "Strong",
      color: "success",
    });
    expect(getRatingPresentation(3.4)).toEqual({
      label: "Watch",
      color: "warning",
    });
    expect(getRatingPresentation(2.4)).toEqual({
      label: "Needs attention",
      color: "error",
    });
    expect(getRatingPresentation(null)).toEqual({
      label: "No reviews",
      color: "default",
    });
  });

  test("builds compact report queries without empty filters", () => {
    expect(
      buildReportQuery({
        page: 2,
        pageSize: 10,
        search: "River School",
        moduleId: "",
        rating: 4,
        from: "",
        to: "2026-06-12",
      })
    ).toBe("page=2&pageSize=10&search=River+School&rating=4&to=2026-06-12");
  });

  test("identity reveal remains system-admin only", () => {
    expect(canRevealIdentity("system_admin")).toBe(true);
    expect(canRevealIdentity("school_admin")).toBe(false);
    expect(canRevealIdentity("teacher")).toBe(false);
  });

  test("maps API rating counts into chart-ready rows", () => {
    expect(getRatingDistribution({ rating_1: 2, rating_5: 7 })).toEqual([
      { rating: 5, count: 7 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 2 },
    ]);
  });

  test("keeps empty rating bars empty", () => {
    expect(getRatingPercent(0, 0)).toBe(0);
    expect(getRatingPercent(2, 4)).toBe(50);
  });

  test("does not render stale template data as a course report", () => {
    expect(reportMatchesMode({ mode: "template" }, true)).toBe(false);
    expect(reportMatchesMode({ mode: "course" }, true)).toBe(true);
    expect(reportMatchesMode({ mode: "template" }, false)).toBe(true);
  });
});
