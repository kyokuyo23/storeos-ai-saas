import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => (process.env.OWNER_OPEN_ID = "owner-1", {
  listShiftCheckIngredients: vi.fn(async () => [{ id: 1, name: "Gelas cup", unit: "pcs" }]),
  submitShiftCheck: vi.fn(async () => ({ id: 9, reference: "SHC-1", status: "pending" })),
  listShiftChecks: vi.fn(async (_filter: unknown) => []),
  getShiftCheck: vi.fn(async (_id: number) => ({ id: 9, submittedByUserId: 2 }) as unknown),
  reviewShiftCheck: vi.fn(async () => ({ id: 9, status: "approved" })),
  setIngredientShiftCheck: vi.fn(async () => ({ success: true })),
}));

vi.mock("./shiftChecks", async (importOriginal) => ({ ...(await importOriginal<typeof import("./shiftChecks")>()), ...h }));
vi.mock("./db", () => ({}));
vi.mock("./monthlyReportArtifacts", () => ({ canAccessMonthlyReportArtifacts: () => false }));

import { appRouter } from "./routers";
import { breakdownMovements, decodePhotos, planIncome, planShiftCheck, startOfJakartaDay } from "./shiftChecks";

const caller = (user: Record<string, unknown> | null) => appRouter.createCaller({ user: user as any, req: {} as any, res: { clearCookie: vi.fn() } as any });
const owner = { id: 1, openId: "owner-1", role: "admin", name: "Pemilik" };
const kasir = { id: 2, openId: "member_k1", role: "user", name: "Kasir 1", username: "kasir1", isActive: true, accessLevel: "member" };
const kasir2 = { ...kasir, id: 3, openId: "member_k2", username: "kasir2" };
const sysadmin = { ...kasir, id: 4, openId: "member_sys", username: "sysadmin", accessLevel: "sysadmin" };
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");

describe("shift reconciliation rules", () => {
  it("stok awal + pembelian − pemakaian + lain-lain = stok akhir seharusnya; selisih in qty and Rupiah", () => {
    const movements = breakdownMovements([
      { ingredientId: 1, type: "purchase", delta: 100 },
      { ingredientId: 1, type: "sale", delta: -30 },
      { ingredientId: 1, type: "void", delta: 2 },
      { ingredientId: 1, type: "waste", delta: -1 },
      { ingredientId: 2, type: "sale", delta: -150 },
    ]);
    expect(movements.get(1)).toEqual({ purchase: 100, usage: 28, other: -1 });
    const plan = planShiftCheck(
      [{ id: 1, name: "Gelas cup", unit: "pcs", currentStock: 121, costPerUnit: 1500 }, { id: 2, name: "Gula", unit: "gram", currentStock: 850, costPerUnit: 20 }],
      [{ ingredientId: 1, countedQuantity: 118 }, { ingredientId: 2, countedQuantity: 850 }],
      movements,
    );
    expect(plan.items[0]).toMatchObject({ openingQuantity: 50, purchaseQuantity: 100, usageQuantity: 28, otherQuantity: -1, systemQuantity: 121, countedQuantity: 118, variance: -3 });
    expect(plan.items[1]).toMatchObject({ openingQuantity: 1000, usageQuantity: 150, systemQuantity: 850, variance: 0 });
    expect(plan.varianceItemCount).toBe(1);
    expect(plan.totalVarianceValue).toBe(-4500);
  });

  it("requires every flagged item exactly once and a flagged list", () => {
    const flagged = [{ id: 1, name: "Gelas", unit: "pcs", currentStock: 5, costPerUnit: 1 }];
    expect(() => planShiftCheck([], [{ ingredientId: 1, countedQuantity: 1 }])).toThrow(/Belum ada bahan/);
    expect(() => planShiftCheck(flagged, [{ ingredientId: 1, countedQuantity: 1 }, { ingredientId: 1, countedQuantity: 1 }])).toThrow(/tepat satu kali/);
    expect(() => planShiftCheck(flagged, [{ ingredientId: 2, countedQuantity: 1 }])).toThrow(/tepat satu kali/);
  });

  it("pemasukan: cash − opening float + non-cash compared with net sales", () => {
    expect(planIncome({ netSales: 250000, openingCash: 100000, countedCash: 280000, countedNonCash: 70000 })).toEqual({ received: 250000, incomeVariance: 0 });
    expect(planIncome({ netSales: 250000, openingCash: 100000, countedCash: 260000, countedNonCash: 70000 }).incomeVariance).toBe(-20000);
    expect(startOfJakartaDay(new Date("2026-10-13T18:30:00Z")).toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });

  it("accepts real image bytes only, max 3 photos' worth of size", () => {
    expect(decodePhotos([{ contentType: "image/jpeg", dataBase64: jpeg }])[0].data.byteLength).toBe(7);
    expect(() => decodePhotos([{ contentType: "image/png", dataBase64: jpeg }])).toThrow(/foto/);
    expect(() => decodePhotos([{ contentType: "image/jpeg", dataBase64: Buffer.from("<svg/>").toString("base64") }])).toThrow(/foto/);
  });
});

describe("shift check access", () => {
  beforeEach(() => vi.clearAllMocks());
  const submit = { counts: [{ ingredientId: 1, countedQuantity: 3 }], photos: [{ contentType: "image/jpeg" as const, dataBase64: jpeg }], countedCash: 100000, countedNonCash: 0 };

  it("requires login and 1–3 photos plus cash counts", async () => {
    await expect(caller(null).shiftCheck.items()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(kasir).shiftCheck.submit({ ...submit, photos: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(kasir).shiftCheck.submit({ ...submit, photos: Array(4).fill(submit.photos[0]) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(kasir).shiftCheck.submit({ ...submit, countedCash: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller(kasir).shiftCheck.submit(submit);
    expect(h.submitShiftCheck).toHaveBeenCalledWith(kasir, expect.objectContaining({ countedCash: 100000 }));
  });

  it("cashiers see only their own checks and cannot review or flag items", async () => {
    await caller(kasir).shiftCheck.list();
    expect(h.listShiftChecks).toHaveBeenLastCalledWith({ status: undefined, submittedByUserId: 2 });
    await caller(owner).shiftCheck.list({ status: "pending" });
    expect(h.listShiftChecks).toHaveBeenLastCalledWith({ status: "pending" });
    await expect(caller(kasir).shiftCheck.get({ id: 9 })).resolves.toMatchObject({ id: 9 });
    await expect(caller(kasir2).shiftCheck.get({ id: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(kasir).shiftCheck.review({ id: 9, decision: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(kasir).ingredient.setShiftCheck({ id: 1, shiftCheck: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.reviewShiftCheck).not.toHaveBeenCalled();
  });

  it("owner and sysadmin review; rejection needs a reason; sysadmin cannot self-approve", async () => {
    await expect(caller(sysadmin).shiftCheck.review({ id: 9, decision: "reject" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller(sysadmin).shiftCheck.review({ id: 9, decision: "approve" });
    expect(h.reviewShiftCheck).toHaveBeenLastCalledWith(expect.objectContaining({ id: 4, canReviewOwn: false }), { id: 9, decision: "approve" });
    await caller(owner).shiftCheck.review({ id: 9, decision: "reject", note: "Hitung ulang" });
    expect(h.reviewShiftCheck).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1, canReviewOwn: true }), { id: 9, decision: "reject", note: "Hitung ulang" });
    await caller(sysadmin).ingredient.setShiftCheck({ id: 1, shiftCheck: true });
    expect(h.setIngredientShiftCheck).toHaveBeenCalledWith(1, true);
  });
});
