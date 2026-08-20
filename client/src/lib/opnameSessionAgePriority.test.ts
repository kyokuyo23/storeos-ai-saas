import { describe, expect, it } from "vitest";
import { getJakartaCalendarDayAge, getOpnameHistorySessionPriority, getOpenOpnameAgePriority, sortOpnameHistorySessionsByPriority } from "./opnameSessionAgePriority";

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

  it("orders critical sessions first, then follows age and audit reference deterministically within a priority", () => {
    const sessions = [
      { reference: "OPN-NORMAL", occurredAt: new Date("2026-08-19T09:00:00.000Z"), tone: "normal" as const },
      { reference: "OPN-CRITICAL-B", occurredAt: new Date("2026-08-18T10:00:00.000Z"), tone: "critical" as const },
      { reference: "OPN-RESOLVED", occurredAt: new Date("2026-08-15T10:00:00.000Z"), tone: "resolved" as const },
      { reference: "OPN-CRITICAL-A", occurredAt: new Date("2026-08-18T10:00:00.000Z"), tone: "critical" as const },
      { reference: "OPN-WARNING", occurredAt: new Date("2026-08-17T10:00:00.000Z"), tone: "warning" as const },
    ];
    const ordered = sortOpnameHistorySessionsByPriority(
      sessions,
      (session) => ({ tone: session.tone, label: session.tone, description: session.tone, ageDays: 0 }),
      (session) => session.occurredAt,
      (session) => session.reference,
    );

    expect(ordered.map((session) => session.reference)).toEqual(["OPN-CRITICAL-A", "OPN-CRITICAL-B", "OPN-WARNING", "OPN-NORMAL", "OPN-RESOLVED"]);
  });
});
