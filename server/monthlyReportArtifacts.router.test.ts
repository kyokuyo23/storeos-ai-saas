import { describe, expect, it, vi } from "vitest";

const { getMonthlyReportArtifactGovernanceSummary, getMonthlyReportArtifactLifecycleHistory, listMonthlyReportArtifacts } = vi.hoisted(() => ({
  listMonthlyReportArtifacts: vi.fn(async () => []),
  getMonthlyReportArtifactGovernanceSummary: vi.fn(async () => ({ retainedArtifactCount: 0 })),
  getMonthlyReportArtifactLifecycleHistory: vi.fn(async () => null),
}));
vi.mock("./monthlyReportArtifacts", () => ({
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null) => user?.openId === "owner-1" && user.role === "admin",
  getMonthlyReportArtifactGovernanceSummary,
  getMonthlyReportArtifactLifecycleHistory,
  listMonthlyReportArtifacts,
}));

import { appRouter } from "./routers";

function caller(user: { openId: string; role: string } | null) {
  return appRouter.createCaller({ user, req: {} as any, res: { clearCookie: vi.fn() } as any });
}

describe("reports.monthlyArtifacts authorization", () => {
  it("rejects anonymous artifact access", async () => {
    await expect(caller(null).reports.monthlyArtifacts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an authenticated non-owner admin and prevents cross-workspace list access", async () => {
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifacts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listMonthlyReportArtifacts).not.toHaveBeenCalled();
  });

  it("allows the current StoreOS owner to request only their filtered metadata", async () => {
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifacts({ year: 2026, month: 1 })).resolves.toEqual([]);
    expect(listMonthlyReportArtifacts).toHaveBeenCalledWith("owner-1", { year: 2026, month: 1 });
  });

  it("limits governance totals to the current owner-admin scope", async () => {
    await expect(caller(null).reports.monthlyArtifactGovernance()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifactGovernance()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getMonthlyReportArtifactGovernanceSummary).not.toHaveBeenCalled();
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernance()).resolves.toEqual({ retainedArtifactCount: 0 });
    expect(getMonthlyReportArtifactGovernanceSummary).toHaveBeenCalledWith("owner-1");
  });

  it("limits lifecycle-history access to the owner-admin scope and forwards only the requested period", async () => {
    await expect(caller(null).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getMonthlyReportArtifactLifecycleHistory).not.toHaveBeenCalled();
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).resolves.toBeNull();
    expect(getMonthlyReportArtifactLifecycleHistory).toHaveBeenCalledWith(2026, 1, "owner-1");
  });
});
