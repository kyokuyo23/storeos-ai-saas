import { describe, expect, it, vi } from "vitest";

const { listMonthlyReportArtifacts } = vi.hoisted(() => ({ listMonthlyReportArtifacts: vi.fn(async () => []) }));
vi.mock("./monthlyReportArtifacts", () => ({
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null) => user?.openId === "owner-1" && user.role === "admin",
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
});
