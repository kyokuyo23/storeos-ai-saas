import { describe, expect, it } from "vitest";

import {
  GOVERNANCE_AUDIT_DATE_PRESETS,
  governanceAuditWibStart,
  matchesGovernanceAuditSearch,
  resolveGovernanceAuditDateRange,
  validateGovernanceAuditDateSearchFilters,
} from "./governanceAuditDateSearch";

describe("Phase 2.18 governance audit date presets and safe search", () => {
  it.each([
    ["today", "Hari ini", "2026-09-01", "2026-09-01", "2026-09-02 00:00:00 WIB"],
    ["last_7_days", "7 hari terakhir", "2026-08-26", "2026-09-01", "2026-09-02 00:00:00 WIB"],
    ["last_30_days", "30 hari terakhir", "2026-08-03", "2026-09-01", "2026-09-02 00:00:00 WIB"],
    ["current_month", "Bulan berjalan", "2026-09-01", "2026-09-30", "2026-10-01 00:00:00 WIB"],
    ["previous_month", "Bulan sebelumnya", "2026-08-01", "2026-08-31", "2026-09-01 00:00:00 WIB"],
    ["last_3_months", "3 bulan terakhir", "2026-07-01", "2026-09-30", "2026-10-01 00:00:00 WIB"],
    ["last_12_months", "12 bulan terakhir", "2025-10-01", "2026-09-30", "2026-10-01 00:00:00 WIB"],
  ] as const)("resolves %s from the same Asia/Jakarta date at Jakarta midnight", (preset, label, startDate, endDate, endWib) => {
    const resolved = resolveGovernanceAuditDateRange({ datePreset: preset }, new Date("2026-08-31T17:00:00.000Z"));
    expect(resolved).toMatchObject({ preset, label, startDate, endDate, startWib: `${startDate} 00:00:00 WIB`, endWib, boundary: "start_inclusive_end_exclusive_wib" });
  });

  it("resolves calendar rollover, December-to-January, and leap/non-leap February using Jakarta rather than browser-local time", () => {
    expect(resolveGovernanceAuditDateRange({ datePreset: "previous_month" }, new Date("2027-01-01T00:05:00.000Z"))).toMatchObject({ startDate: "2026-12-01", endDate: "2026-12-31", endWib: "2027-01-01 00:00:00 WIB" });
    expect(resolveGovernanceAuditDateRange({ datePreset: "current_month" }, new Date("2024-02-29T15:00:00.000Z"))).toMatchObject({ startDate: "2024-02-01", endDate: "2024-02-29", endWib: "2024-03-01 00:00:00 WIB" });
    expect(resolveGovernanceAuditDateRange({ datePreset: "previous_month" }, new Date("2025-03-01T01:00:00.000Z"))).toMatchObject({ startDate: "2025-02-01", endDate: "2025-02-28", endWib: "2025-03-01 00:00:00 WIB" });
    expect(governanceAuditWibStart("2026-09-01").toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("keeps manual end dates inclusive only through their Jakarta day and rejects ambiguous filter values", () => {
    expect(resolveGovernanceAuditDateRange({ startDate: "2026-08-31", endDate: "2026-08-31" })).toMatchObject({ startWib: "2026-08-31 00:00:00 WIB", endWib: "2026-09-01 00:00:00 WIB" });
    expect(() => validateGovernanceAuditDateSearchFilters({ startDate: "2026-09-02", endDate: "2026-09-01" })).toThrow("Tanggal mulai");
    expect(() => validateGovernanceAuditDateSearchFilters({ datePreset: "all_time" as never })).toThrow("Preset");
    expect(() => validateGovernanceAuditDateSearchFilters({ searchTerm: " " })).toThrow("pencarian");
    expect(GOVERNANCE_AUDIT_DATE_PRESETS).toHaveLength(7);
  });

  it("matches only literal case-insensitive searchable evidence without query interpretation", () => {
    const evidence = ["receipt-001", "export-sha-abc", "qrph_policy_22", "Admin-Café", "qr_abcdef123456"];
    expect(matchesGovernanceAuditSearch("RECEIPT-001", evidence)).toBe(true);
    expect(matchesGovernanceAuditSearch("export-sha", evidence)).toBe(true);
    expect(matchesGovernanceAuditSearch("policy_22", evidence)).toBe(true);
    expect(matchesGovernanceAuditSearch("café", evidence)).toBe(true);
    expect(matchesGovernanceAuditSearch("abcdef", evidence)).toBe(true);
    expect(matchesGovernanceAuditSearch(".*", evidence)).toBe(false);
  });
});
