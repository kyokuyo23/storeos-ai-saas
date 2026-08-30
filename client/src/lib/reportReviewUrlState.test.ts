import { describe, expect, it } from "vitest";
import { getFocusedMonthForReportReviewPreset, getReportReviewPath, parseReportReviewUrlState } from "./reportReviewUrlState";

describe("report review URL state", () => {
  const current = { year: 2026, month: 9 };

  it("restores only whitelisted presets and valid manual month focus", () => {
    expect(parseReportReviewUrlState("?reportPreset=current_quarter&reportYear=2026&reportMonth=9", current)).toEqual({ preset: "current_quarter", year: 2026, month: 9, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } });
    expect(parseReportReviewUrlState("?reportPreset=all_time&reportYear=1999&reportMonth=13", current)).toEqual({ preset: null, year: 2026, month: 9, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } });
  });

  it("preserves an authoritative manual selection when no preset is present and resets default state to the base path", () => {
    expect(parseReportReviewUrlState("?reportYear=2025&reportMonth=12", current)).toEqual({ preset: null, year: 2025, month: 12, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } });
    expect(getReportReviewPath({ preset: null, year: 2026, month: 9, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } }, current)).toBe("/reports");
    expect(getReportReviewPath({ preset: null, year: 2025, month: 12, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } }, current)).toBe("/reports?reportYear=2025&reportMonth=12");
  });

  it("restores only explicit active-list filters and preserves report-review context in a shared deep-link", () => {
    const state = parseReportReviewUrlState("?reportPreset=previous_quarter&reportYear=2026&reportMonth=6&artifactView=active&artifactFormat=pdf&artifactIntegrity=healthy&artifactRetention=approaching", current);
    expect(state).toEqual({ preset: "previous_quarter", year: 2026, month: 6, artifactList: { active: true, format: "pdf", integrity: "healthy", retentionStatus: "approaching" } });
    expect(getReportReviewPath(state, current)).toBe("/reports?reportYear=2026&reportMonth=6&reportPreset=previous_quarter&artifactView=active&artifactFormat=pdf&artifactIntegrity=healthy&artifactRetention=approaching");
    expect(parseReportReviewUrlState("?artifactFormat=pdf&artifactIntegrity=healthy&artifactRetention=approaching", current).artifactList).toEqual({ active: false, format: null, integrity: null, retentionStatus: null });
  });

  it("whitelists retention status and keeps a valid active-list state when other filter values are invalid", () => {
    expect(parseReportReviewUrlState("?artifactView=active&artifactRetention=eligible", current).artifactList).toEqual({ active: true, format: null, integrity: null, retentionStatus: "eligible" });
    expect(parseReportReviewUrlState("?artifactView=active&artifactRetention=archive_now", current).artifactList).toEqual({ active: true, format: null, integrity: null, retentionStatus: null });
  });

  it("chooses the latest included monthly focus across year and quarter rollovers without calculating a business boundary", () => {
    expect(getFocusedMonthForReportReviewPreset("previous_month", { year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(getFocusedMonthForReportReviewPreset("previous_quarter", { year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(getFocusedMonthForReportReviewPreset("current_quarter", { year: 2026, month: 2 })).toEqual({ year: 2026, month: 3 });
  });
});
