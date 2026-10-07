import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createRetentionSummaryExport: vi.fn(async () => ({ outcome: "empty" })),
  getRetentionSummaryExport: vi.fn(async () => ({ status: "NOT_FOUND" })),
  verifyRetentionSummaryExport: vi.fn(async () => ({ status: "VERIFIED" })),
}));

vi.mock("./retentionSummaryExport", () => h);
vi.mock("./monthlyReportArtifacts", () => ({
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null) => user?.openId === "owner-1" && user.role === "admin",
}));
vi.mock("./db", () => ({}));

import { appRouter } from "./routers";

const caller = (user: { openId: string; role: string } | null) => appRouter.createCaller({ user, req: {} as any, res: { clearCookie: vi.fn() } as any });
const owner = { openId: "owner-1", role: "admin" };
const exportId = `storeos-retention-summary-csv-${"a".repeat(64)}`;

describe("reports retention summary export authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects anonymous, member and cross-workspace callers before any service is invoked", async () => {
    for (const user of [null, { openId: "owner-1", role: "user" }, { openId: "other-workspace", role: "admin" }]) {
      const expected = { code: user ? "FORBIDDEN" : "UNAUTHORIZED" };
      await expect(caller(user).reports.createMonthlyRetentionSummaryExport({ datePreset: "last_3_months", format: "csv" })).rejects.toMatchObject(expected);
      await expect(caller(user).reports.getMonthlyRetentionSummaryExport({ exportId })).rejects.toMatchObject(expected);
      await expect(caller(user).reports.verifyMonthlyRetentionSummaryExport({ exportId })).rejects.toMatchObject(expected);
    }
    expect(h.createRetentionSummaryExport).not.toHaveBeenCalled();
    expect(h.getRetentionSummaryExport).not.toHaveBeenCalled();
    expect(h.verifyRetentionSummaryExport).not.toHaveBeenCalled();
  });

  it("forwards only the authenticated owner and the validated review scope; client scope/owner fields are not accepted", async () => {
    await caller(owner).reports.createMonthlyRetentionSummaryExport({ startDate: "2026-07-01", endDate: "2026-09-30", format: "pdf" });
    expect(h.createRetentionSummaryExport).toHaveBeenCalledWith(owner, { startDate: "2026-07-01", endDate: "2026-09-30" }, "pdf");
    await caller(owner).reports.createMonthlyRetentionSummaryExport({ ownerOpenId: "owner-2", scopeId: "x", datePreset: "current_year", format: "html" } as any);
    expect(h.createRetentionSummaryExport).toHaveBeenLastCalledWith(owner, { datePreset: "current_year" }, "html");
    await caller(owner).reports.verifyMonthlyRetentionSummaryExport({ exportId, ownerOpenId: "owner-2" } as any);
    expect(h.verifyRetentionSummaryExport).toHaveBeenCalledWith(owner, exportId);
    await caller(owner).reports.getMonthlyRetentionSummaryExport({ exportId });
    expect(h.getRetentionSummaryExport).toHaveBeenCalledWith(owner, exportId);
  });

  it("rejects invalid scope, format, and identifiers before reaching the service (invalid review scope)", async () => {
    const api = caller(owner).reports;
    await expect(api.createMonthlyRetentionSummaryExport({ format: "csv" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.createMonthlyRetentionSummaryExport({ datePreset: "current_month", startDate: "2026-01-01", endDate: "2026-01-31", format: "csv" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.createMonthlyRetentionSummaryExport({ startDate: "2026-01-01", format: "csv" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.createMonthlyRetentionSummaryExport({ datePreset: "current_month", format: "xlsx" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.verifyMonthlyRetentionSummaryExport({ exportId: "short" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(h.createRetentionSummaryExport).not.toHaveBeenCalled();
    expect(h.verifyRetentionSummaryExport).not.toHaveBeenCalled();
  });
});
