/**
 * Phase 2.24 — Cek Akhir Shift: blind count of owner-flagged ingredients with 1–3 photos.
 * A count that differs from the system balance stays "pending" (stock untouched) until the owner or a
 * sysadmin approves it; approval applies the variance as an opname movement. See FRD-Phase-2.24.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ingredients, shiftCheckItems, shiftCheckPhotos, shiftChecks, stockMovements, storedObjects } from "../drizzle/schema";
import { getSettings, listSales, requireDb } from "./db";
import { summarizeFinancialSales, type FinancialSale } from "./financials";

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 1_500_000;
export const MAX_TOTAL_PHOTO_BYTES = 3_500_000;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const PHOTO_ERROR = `Lampirkan 1–${MAX_PHOTOS} foto JPG/PNG/WebP maks. 1,5 MB.`;

export const shiftCheckSubmitInput = z.object({
  counts: z.array(z.object({
    ingredientId: z.number().int().positive(),
    countedQuantity: z.number({ message: "Jumlah fisik harus berupa angka." }).finite().min(0, "Jumlah fisik tidak boleh negatif.").max(1_000_000_000),
  })).min(1).max(200),
  photos: z.array(z.object({ contentType: z.enum(PHOTO_TYPES), dataBase64: z.string().min(1).max(Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 4) }), { message: PHOTO_ERROR }).min(1, PHOTO_ERROR).max(MAX_PHOTOS, PHOTO_ERROR),
  countedCash: z.number({ message: "Uang tunai harus berupa angka." }).finite().min(0, "Uang tunai tidak boleh negatif.").max(1_000_000_000),
  countedNonCash: z.number({ message: "Non-tunai harus berupa angka." }).finite().min(0, "Non-tunai tidak boleh negatif.").max(1_000_000_000),
  note: z.string().trim().max(1000).optional().nullable(),
});
export const shiftCheckReviewInput = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional().nullable(),
}).refine((input) => input.decision !== "reject" || Boolean(input.note?.trim()), { message: "Alasan penolakan wajib diisi.", path: ["note"] });
export const shiftCheckListInput = z.object({ status: z.enum(["matched", "pending", "approved", "rejected"]).optional() }).optional();

type Actor = { id: number; name: string | null; username?: string | null };
const actorName = (actor: Actor) => (actor.name || actor.username || `Pengguna #${actor.id}`).slice(0, 120);
const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Decode and check photo bytes by magic number (not just the declared type). */
export function decodePhotos(photos: Array<{ contentType: (typeof PHOTO_TYPES)[number]; dataBase64: string }>) {
  const decoded = photos.map((photo) => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.dataBase64)) throw new TRPCError({ code: "BAD_REQUEST", message: PHOTO_ERROR });
    const data = Buffer.from(photo.dataBase64, "base64");
    const isJpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isWebp = data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP";
    const matches = (photo.contentType === "image/jpeg" && isJpeg) || (photo.contentType === "image/png" && isPng) || (photo.contentType === "image/webp" && isWebp);
    if (!matches || data.byteLength === 0 || data.byteLength > MAX_PHOTO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: PHOTO_ERROR });
    return { contentType: photo.contentType, data };
  });
  if (decoded.reduce((total, photo) => total + photo.data.byteLength, 0) > MAX_TOTAL_PHOTO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Total foto terlalu besar (maks. 3,5 MB). Kurangi jumlah atau ukuran foto." });
  return decoded;
}

export type MovementBreakdown = { purchase: number; usage: number; other: number };
const SALE_TYPES = new Set(["sale", "exchange_sale", "void", "refund", "partial_refund", "exchange_return"]);

/** Group ledger deltas within the shift: purchases, net sales usage (positive = used), and everything else. */
export function breakdownMovements(rows: Array<{ ingredientId: number; type: string; delta: number }>) {
  const byId = new Map<number, MovementBreakdown>();
  for (const row of rows) {
    const entry = byId.get(row.ingredientId) ?? { purchase: 0, usage: 0, other: 0 };
    if (row.type === "purchase") entry.purchase += row.delta;
    else if (SALE_TYPES.has(row.type)) entry.usage -= row.delta;
    else entry.other += row.delta;
    byId.set(row.ingredientId, entry);
  }
  return byId;
}

/**
 * Stok awal shift + pembelian − pemakaian penjualan + lain-lain = stok akhir seharusnya (the live system balance).
 * Every flagged active ingredient must be counted exactly once; variance = counted − expected, in qty and Rupiah.
 */
export function planShiftCheck(
  flagged: Array<{ id: number; name: string; unit: string; currentStock: number; costPerUnit: number }>,
  counts: Array<{ ingredientId: number; countedQuantity: number }>,
  movements: Map<number, MovementBreakdown> = new Map(),
) {
  if (!flagged.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Belum ada bahan yang ditandai untuk cek akhir shift." });
  const countById = new Map<number, number>();
  for (const count of counts) {
    if (countById.has(count.ingredientId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Hitung semua bahan cek shift tepat satu kali." });
    countById.set(count.ingredientId, count.countedQuantity);
  }
  if (countById.size !== flagged.length || flagged.some((ingredient) => !countById.has(ingredient.id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Hitung semua bahan cek shift tepat satu kali. Daftar bahan mungkin baru diubah; muat ulang halaman." });
  const items = flagged.map((ingredient) => {
    const moved = movements.get(ingredient.id) ?? { purchase: 0, usage: 0, other: 0 };
    const systemQuantity = round(ingredient.currentStock, 3);
    const purchaseQuantity = round(moved.purchase, 3);
    const usageQuantity = round(moved.usage, 3);
    const otherQuantity = round(moved.other, 3);
    const openingQuantity = round(systemQuantity - purchaseQuantity + usageQuantity - otherQuantity, 3);
    const countedQuantity = round(countById.get(ingredient.id)!, 3);
    return { ingredientId: ingredient.id, ingredientName: ingredient.name, unit: ingredient.unit, openingQuantity, purchaseQuantity, usageQuantity, otherQuantity, systemQuantity, countedQuantity, variance: round(countedQuantity - systemQuantity, 3), costPerUnit: ingredient.costPerUnit };
  });
  const varianceItems = items.filter((item) => item.variance !== 0);
  return {
    items,
    varianceItemCount: varianceItems.length,
    totalVarianceValue: round(varianceItems.reduce((total, item) => total + item.variance * item.costPerUnit, 0), 2),
  };
}

/** Pemasukan: expected = net sales of the shift; received = cash in drawer − opening float + non-cash. */
export function planIncome(input: { netSales: number; openingCash: number; countedCash: number; countedNonCash: number }) {
  const received = round(input.countedCash - input.openingCash + input.countedNonCash, 2);
  return { received, incomeVariance: round(received - input.netSales, 2) };
}

/** Shift window start: the previous end-of-shift check, else 00:00 WIB today. */
export function startOfJakartaDay(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${day}T00:00:00+07:00`);
}

/** Cashier-facing list: names and units only — never the system balance (blind count). */
export async function listShiftCheckIngredients() {
  const db = await requireDb();
  return db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit }).from(ingredients)
    .where(and(eq(ingredients.shiftCheck, true), eq(ingredients.isActive, true))).orderBy(ingredients.name);
}

export async function setIngredientShiftCheck(id: number, shiftCheck: boolean) {
  const db = await requireDb();
  const rows = await db.update(ingredients).set({ shiftCheck }).where(eq(ingredients.id, id)).returning({ id: ingredients.id });
  if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Bahan tidak ditemukan." });
  return { success: true } as const;
}

export async function submitShiftCheck(actor: Actor, input: z.infer<typeof shiftCheckSubmitInput>, now = new Date()) {
  const photos = decodePhotos(input.photos);
  const db = await requireDb();
  const previous = (await db.select({ submittedAt: shiftChecks.submittedAt }).from(shiftChecks).orderBy(desc(shiftChecks.submittedAt)).limit(1))[0];
  const shiftStartedAt = previous?.submittedAt && previous.submittedAt < now ? previous.submittedAt : startOfJakartaDay(now);
  const [settings, allSales] = await Promise.all([getSettings(), listSales()]);
  const shiftSales = (allSales as unknown as FinancialSale[]).filter((sale) => sale.completedAt >= shiftStartedAt && sale.completedAt < now);
  const finance = summarizeFinancialSales(shiftSales);
  const netSales = round(finance.revenue, 2);
  const openingCash = round(settings.shiftOpeningCash ?? 0, 2);
  const income = planIncome({ netSales, openingCash, countedCash: input.countedCash, countedNonCash: input.countedNonCash });
  return db.transaction(async (tx) => {
    const flagged = await tx.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit, currentStock: ingredients.currentStock, costPerUnit: ingredients.costPerUnit })
      .from(ingredients).where(and(eq(ingredients.shiftCheck, true), eq(ingredients.isActive, true))).orderBy(ingredients.name).for("update");
    const ids = flagged.map((row) => row.id);
    const movementRows = ids.length ? await tx.select({ ingredientId: stockMovements.ingredientId, type: stockMovements.type, delta: sql<number>`sum(${stockMovements.quantityDelta})`.mapWith(Number) })
      .from(stockMovements).where(and(inArray(stockMovements.ingredientId, ids), gte(stockMovements.occurredAt, shiftStartedAt))).groupBy(stockMovements.ingredientId, stockMovements.type) : [];
    const plan = planShiftCheck(flagged, input.counts, breakdownMovements(movementRows));
    const status = plan.varianceItemCount > 0 || income.incomeVariance !== 0 ? "pending" as const : "matched" as const;
    const reference = `SHC-${Date.now()}-${nanoid(5).toUpperCase()}`;
    const [check] = await tx.insert(shiftChecks).values({
      reference, status, submittedByUserId: actor.id, submittedByName: actorName(actor), note: input.note?.trim() || null, shiftStartedAt,
      varianceItemCount: plan.varianceItemCount, totalVarianceValue: plan.totalVarianceValue,
      saleCount: finance.saleCount, grossSales: round(finance.grossSales, 2), voidRefundValue: round(finance.voidValue + finance.refundValue, 2), netSales,
      openingCash, countedCash: round(input.countedCash, 2), countedNonCash: round(input.countedNonCash, 2), incomeVariance: income.incomeVariance,
      submittedAt: now,
    }).returning({ id: shiftChecks.id, submittedAt: shiftChecks.submittedAt });
    await tx.insert(shiftCheckItems).values(plan.items.map((item) => ({ shiftCheckId: check.id, ...item })));
    for (let index = 0; index < photos.length; index += 1) { const photo = photos[index];
      const storageKey = `shift-checks/${reference}/photo-${index + 1}-${nanoid(8)}`;
      await tx.insert(storedObjects).values({ storageKey, contentType: photo.contentType, byteSize: photo.data.byteLength, data: photo.data });
      await tx.insert(shiftCheckPhotos).values({ shiftCheckId: check.id, storageKey, contentType: photo.contentType, byteSize: photo.data.byteLength });
    }
    return { id: check.id, reference, status, varianceItemCount: plan.varianceItemCount, totalVarianceValue: plan.totalVarianceValue, incomeVariance: income.incomeVariance, submittedAt: check.submittedAt };
  });
}

const summaryColumns = {
  id: shiftChecks.id, reference: shiftChecks.reference, status: shiftChecks.status, submittedByUserId: shiftChecks.submittedByUserId, submittedByName: shiftChecks.submittedByName,
  note: shiftChecks.note, shiftStartedAt: shiftChecks.shiftStartedAt, varianceItemCount: shiftChecks.varianceItemCount, totalVarianceValue: shiftChecks.totalVarianceValue, submittedAt: shiftChecks.submittedAt,
  saleCount: shiftChecks.saleCount, grossSales: shiftChecks.grossSales, voidRefundValue: shiftChecks.voidRefundValue, netSales: shiftChecks.netSales,
  openingCash: shiftChecks.openingCash, countedCash: shiftChecks.countedCash, countedNonCash: shiftChecks.countedNonCash, incomeVariance: shiftChecks.incomeVariance,
  reviewedByName: shiftChecks.reviewedByName, reviewNote: shiftChecks.reviewNote, reviewedAt: shiftChecks.reviewedAt,
};

export async function listShiftChecks(filter: { submittedByUserId?: number; status?: "matched" | "pending" | "approved" | "rejected" }) {
  const db = await requireDb();
  const conditions = [
    filter.submittedByUserId !== undefined ? eq(shiftChecks.submittedByUserId, filter.submittedByUserId) : undefined,
    filter.status ? eq(shiftChecks.status, filter.status) : undefined,
  ].filter(Boolean);
  return db.select(summaryColumns).from(shiftChecks).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(shiftChecks.submittedAt), desc(shiftChecks.id)).limit(100);
}

export async function getShiftCheck(id: number) {
  const db = await requireDb();
  const check = (await db.select(summaryColumns).from(shiftChecks).where(eq(shiftChecks.id, id)).limit(1))[0];
  if (!check) return null;
  const [items, photos] = await Promise.all([
    db.select({ ingredientId: shiftCheckItems.ingredientId, ingredientName: shiftCheckItems.ingredientName, unit: shiftCheckItems.unit, openingQuantity: shiftCheckItems.openingQuantity, purchaseQuantity: shiftCheckItems.purchaseQuantity, usageQuantity: shiftCheckItems.usageQuantity, otherQuantity: shiftCheckItems.otherQuantity, systemQuantity: shiftCheckItems.systemQuantity, countedQuantity: shiftCheckItems.countedQuantity, variance: shiftCheckItems.variance, costPerUnit: shiftCheckItems.costPerUnit })
      .from(shiftCheckItems).where(eq(shiftCheckItems.shiftCheckId, id)).orderBy(shiftCheckItems.ingredientName),
    db.select({ id: shiftCheckPhotos.id, contentType: shiftCheckPhotos.contentType, byteSize: shiftCheckPhotos.byteSize }).from(shiftCheckPhotos).where(eq(shiftCheckPhotos.shiftCheckId, id)).orderBy(shiftCheckPhotos.id),
  ]);
  return {
    ...check,
    items: items.map((item) => ({ ...item, openingValue: round(item.openingQuantity * item.costPerUnit, 2), purchaseValue: round(item.purchaseQuantity * item.costPerUnit, 2), usageValue: round(item.usageQuantity * item.costPerUnit, 2), systemValue: round(item.systemQuantity * item.costPerUnit, 2), countedValue: round(item.countedQuantity * item.costPerUnit, 2), varianceValue: round(item.variance * item.costPerUnit, 2) })),
    photos,
  };
}

export async function getShiftCheckPhoto(photoId: number) {
  const db = await requireDb();
  const row = (await db.select({ storageKey: shiftCheckPhotos.storageKey, contentType: shiftCheckPhotos.contentType, submittedByUserId: shiftChecks.submittedByUserId })
    .from(shiftCheckPhotos).innerJoin(shiftChecks, eq(shiftCheckPhotos.shiftCheckId, shiftChecks.id)).where(eq(shiftCheckPhotos.id, photoId)).limit(1))[0];
  if (!row) return null;
  const object = (await db.select({ data: storedObjects.data }).from(storedObjects).where(eq(storedObjects.storageKey, row.storageKey)).limit(1))[0];
  return object ? { ...row, data: object.data } : null;
}

export async function getPendingShiftCheckSummary() {
  const db = await requireDb();
  const rows = await db.select({ submittedAt: shiftChecks.submittedAt }).from(shiftChecks).where(eq(shiftChecks.status, "pending")).orderBy(shiftChecks.submittedAt);
  return { pendingCount: rows.length, oldestSubmittedAt: rows[0]?.submittedAt ?? null };
}

/**
 * Approve or reject a pending check exactly once. Approval adds each item's variance to the *current*
 * balance (sales after the count stay correct) as an opname movement referencing the check.
 */
export async function reviewShiftCheck(reviewer: Actor & { canReviewOwn: boolean }, input: z.infer<typeof shiftCheckReviewInput>) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const check = (await tx.select({ id: shiftChecks.id, reference: shiftChecks.reference, status: shiftChecks.status, submittedByUserId: shiftChecks.submittedByUserId }).from(shiftChecks).where(eq(shiftChecks.id, input.id)).limit(1).for("update"))[0];
    if (!check) throw new TRPCError({ code: "NOT_FOUND", message: "Cek shift tidak ditemukan." });
    if (check.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "Cek ini sudah ditinjau atau tidak memerlukan persetujuan." });
    if (check.submittedByUserId === reviewer.id && !reviewer.canReviewOwn) throw new TRPCError({ code: "FORBIDDEN", message: "Cek yang Anda kirim harus ditinjau orang lain." });
    const name = actorName(reviewer);
    const note = input.note?.trim() || null;
    if (input.decision === "approve") {
      const items = (await tx.select({ ingredientId: shiftCheckItems.ingredientId, variance: shiftCheckItems.variance }).from(shiftCheckItems).where(eq(shiftCheckItems.shiftCheckId, check.id))).filter((item) => item.variance !== 0);
      const ids = items.map((item) => item.ingredientId);
      const balances = ids.length ? await tx.select({ id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock }).from(ingredients).where(inArray(ingredients.id, ids)).for("update") : [];
      const byId = new Map(balances.map((row) => [row.id, row]));
      const movementNote = [`Cek akhir shift ${check.reference} disetujui oleh ${name}`, note].filter(Boolean).join(" · ");
      for (const item of items) {
        const row = byId.get(item.ingredientId)!;
        const balanceAfter = round(row.currentStock + item.variance, 3);
        if (balanceAfter < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `Saldo ${row.name} akan menjadi negatif. Lakukan stock opname penuh untuk bahan ini, lalu tolak cek ini.` });
        await tx.update(ingredients).set({ currentStock: balanceAfter }).where(eq(ingredients.id, row.id));
        await tx.insert(stockMovements).values({ ingredientId: row.id, type: "opname", quantityDelta: item.variance, balanceAfter, note: movementNote });
      }
    }
    const updated = await tx.update(shiftChecks).set({ status: input.decision === "approve" ? "approved" : "rejected", reviewedByUserId: reviewer.id, reviewedByName: name, reviewNote: note, reviewedAt: new Date() })
      .where(and(eq(shiftChecks.id, check.id), eq(shiftChecks.status, "pending"))).returning({ id: shiftChecks.id });
    if (!updated.length) throw new TRPCError({ code: "CONFLICT", message: "Cek ini sudah ditinjau." });
    return { id: check.id, reference: check.reference, status: input.decision === "approve" ? "approved" as const : "rejected" as const };
  });
}
