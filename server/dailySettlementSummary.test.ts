import { describe, expect, it } from "vitest";
import { resolveSettlementDateRange, summarizeDailySettlements } from "./db";

describe("daily settlement summary", () => {
  it("separates cash and card settlements while returning the combined daily total", () => {
    expect(summarizeDailySettlements([
      { amount: 8000, paymentMethod: "cash" },
      { amount: 12000, paymentMethod: "card" },
      { amount: 5000, paymentMethod: "cash" },
    ])).toEqual({ cashTotal: 13000, cardTotal: 12000, total: 25000, count: 3 });
  });

  it("returns an explicit zero summary when the Jakarta day has no settlements", () => {
    expect(summarizeDailySettlements([])).toEqual({ cashTotal: 0, cardTotal: 0, total: 0, count: 0 });
  });

  it("includes both selected calendar days in a Jakarta/WIB settlement range", () => {
    const range = resolveSettlementDateRange({ startDate: "2026-08-10", endDate: "2026-08-12" });
    expect(range).toMatchObject({ startDate: "2026-08-10", endDate: "2026-08-12" });
    expect(range.start.toISOString()).toBe("2026-08-09T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-12T17:00:00.000Z");
  });
});
