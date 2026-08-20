import { describe, expect, it } from "vitest";
import { getJakartaCalendarDayAge, getOpnameHistorySessionPriority, getOpenOpnameAgePriority } from "./opnameSessionAgePriority";

describe("getOpenOpnameAgePriority", () => {
  it("marks the absence of unresolved sessions distinctly", () => {
    expect(getOpenOpnameAgePriority(null)).toMatchObject({ tone: "empty", label: "Tidak ada sesi terbuka" });
  });

  it("classifies ages from zero through two days as controlled", () => {
    expect(getOpenOpnameAgePriority(0).tone).toBe("normal");
    expect(getOpenOpnameAgePriority(2).tone).toBe("normal");
  });

  it("uses warning for three to six days and critical from seven days", () => {
    expect(getOpenOpnameAgePriority(3)).toMatchObject({ tone: "warning", label: "Perlu perhatian" });
    expect(getOpenOpnameAgePriority(6).tone).toBe("warning");
    expect(getOpenOpnameAgePriority(7)).toMatchObject({ tone: "critical", label: "Mendesak" });
  });

  it("uses the configured warning and critical thresholds", () => {
    expect(getOpenOpnameAgePriority(4, { warningAgeDays: 4, criticalAgeDays: 9 })).toMatchObject({ tone: "warning", label: "Perlu perhatian" });
    expect(getOpenOpnameAgePriority(9, { warningAgeDays: 4, criticalAgeDays: 9 })).toMatchObject({ tone: "critical", label: "Mendesak" });
  });

  it("uses Jakarta calendar days for session ages", () => {
    expect(getJakartaCalendarDayAge(new Date("2026-08-20T16:00:00.000Z"), new Date("2026-08-21T16:00:00.000Z"))).toBe(1);
  });

  it("shows neutral icons for matching and resolved sessions, then applies configured thresholds to open discrepancies", () => {
    expect(getOpnameHistorySessionPriority({ ageDays: 8, requiresFollowUp: false, isResolved: false })).toMatchObject({ tone: "not_required", label: "Sesuai", ageDays: null });
    expect(getOpnameHistorySessionPriority({ ageDays: 8, requiresFollowUp: true, isResolved: true })).toMatchObject({ tone: "resolved", label: "Tuntas" });
    expect(getOpnameHistorySessionPriority({ ageDays: 5, requiresFollowUp: true, isResolved: false, thresholds: { warningAgeDays: 4, criticalAgeDays: 8 } })).toMatchObject({ tone: "warning", label: "Perlu perhatian", ageDays: 5 });
  });
});
