import { describe, expect, it } from "vitest";
import { getSettlementDatePresets, jakartaDateValue } from "./settlementDateRanges";

describe("Jakarta/WIB settlement date presets", () => {
  it("uses the Jakarta calendar date even when the UTC date differs", () => {
    expect(jakartaDateValue(new Date("2026-08-16T17:30:00.000Z"))).toBe("2026-08-17");
  });

  it("calculates this week from Monday through the current Jakarta date", () => {
    expect(getSettlementDatePresets(new Date("2026-08-19T03:00:00.000Z")).week).toEqual({ startDate: "2026-08-17", endDate: "2026-08-19" });
    expect(getSettlementDatePresets(new Date("2026-08-16T03:00:00.000Z")).week).toEqual({ startDate: "2026-08-10", endDate: "2026-08-16" });
  });

  it("calculates this month from the first day through the current Jakarta date", () => {
    const presets = getSettlementDatePresets(new Date("2026-08-19T03:00:00.000Z"));
    expect(presets.month).toEqual({ startDate: "2026-08-01", endDate: "2026-08-19" });
    expect(presets.today).toEqual({ startDate: "2026-08-19", endDate: "2026-08-19" });
  });
});
