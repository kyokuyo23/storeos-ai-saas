import { describe, expect, it } from "vitest";
import { getFocusedMonthForReportReviewPreset, getReportReviewPath, parseReportReviewUrlState } from "./reportReviewUrlState";

describe("report review URL state", () => {
  const current = { year: 2026, month: 9 };

  it("restores only whitelisted presets and valid manual month focus", () => {
    expect(parseReportReviewUrlState("?reportPreset=current_quarter&reportYear=2026&reportMonth=9", current)).toEqual({ preset: "current_quarter", year: 2026, month: 9 });
    expect(parseReportReviewUrlState("?reportPreset=all_time&reportYear=1999&reportMonth=13", current)).toEqual({ preset: null, year: 2026, month: 9 });
  });

  it("preserves an authoritative manual selection when no preset is present and resets default state to the base path", () => {
    expect(parseReportReviewUrlState("?reportYear=2025&reportMonth=12", current)).toEqual({ preset: null, year: 2025, month: 12 });
    expect(getReportReviewPath({ preset: null, year: 2026, month: 9 }, current)).toBe("/reports");
    expect(getReportReviewPath({ preset: null, year: 2025, month: 12 }, current)).toBe("/reports?reportYear=2025&reportMonth=12");
  });

  it("chooses the latest included monthly focus across year and quarter rollovers without calculating a business boundary", () => {
    expect(getFocusedMonthForReportReviewPreset("previous_month", { year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(getFocusedMonthForReportReviewPreset("previous_quarter", { year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(getFocusedMonthForReportReviewPreset("current_quarter", { year: 2026, month: 2 })).toEqual({ year: 2026, month: 3 });
  });
});
