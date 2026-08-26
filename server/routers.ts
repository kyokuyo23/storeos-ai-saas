import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { mapFoundationError } from "./foundationErrors";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { categoryInput, exchangeInput, exchangeSettlementInput, ingredientInput, inventoryIntelligenceInput, inventoryMovementDrillDownInput, monthlyReportInput, partialRefundInput, productFinancialInput, productInput, recipeInput, saleCompletionInput, saleReversalInput, settlementDateRangeInput, settingsInput, stockMovementInput, stockOpnameBatchInput, stockOpnameFollowUpInput, stockOpnameFollowUpNoteInput, stockOpnameHistoryInput } from "./foundationSchemas";
import { getMonthlyManagementReport } from "./monthlyReports";
import { archiveMonthlyReportArtifactWithOwnerApproval, canAccessMonthlyReportArtifacts, getMonthlyReportArtifactGovernanceAuditExport, getMonthlyReportArtifactGovernanceSummary, getMonthlyReportArtifactLifecycleHistory, listMonthlyReportArtifacts } from "./monthlyReportArtifacts";
import { generateGovernanceAuditExportArtifact, registerGeneratedGovernanceAuditExport, verifyGovernanceAuditExportBytes } from "./governanceAuditExportIntegrity";
import { issueGovernanceAuditVerificationReceipt } from "./governanceAuditVerificationReceipts";
import { resolveGovernanceAuditVerificationQr } from "./governanceAuditVerificationQr";

const idInput = z.object({ id: z.number().int().positive() });
const runMutation = async <T>(entity: string, operation: () => Promise<T>) => {
  try { return await operation(); } catch (error) { throw mapFoundationError(error, entity); }
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  category: router({
    list: publicProcedure.query(() => db.listCategories()),
    create: publicProcedure.input(categoryInput).mutation(({ input }) => runMutation("Kategori", () => db.createCategory(input))),
  }),
  product: router({
    list: publicProcedure.query(() => db.listProducts()),
    financialDetail: publicProcedure.input(productFinancialInput).query(({ input }) => runMutation("Produk", () => db.getProductFinancialDetail(input))),
    create: publicProcedure.input(productInput).mutation(({ input }) => runMutation("Produk", () => db.createProduct(input))),
    update: publicProcedure.input(idInput.extend({ data: productInput })).mutation(({ input }) => runMutation("Produk", () => db.updateProduct(input.id, input.data))),
  }),
  ingredient: router({
    list: publicProcedure.query(() => db.listIngredients()),
    create: publicProcedure.input(ingredientInput).mutation(({ input }) => runMutation("Bahan", () => db.createIngredient(input))),
    update: publicProcedure.input(idInput.extend({ data: ingredientInput })).mutation(({ input }) => runMutation("Bahan", () => db.updateIngredient(input.id, input.data))),
  }),
  stockMovement: router({
    list: publicProcedure.query(() => db.listStockMovements()),
    intelligence: publicProcedure.input(inventoryIntelligenceInput.optional()).query(({ input }) => db.getInventoryIntelligence(input)),
    drillDown: publicProcedure.input(inventoryMovementDrillDownInput).query(({ input }) => runMutation("Bahan", () => db.getIngredientMovementDrillDown(input))),
    record: publicProcedure.input(stockMovementInput).mutation(({ input }) => runMutation("Pergerakan stok", () => db.recordStockMovement(input))),
    recordOpnameBatch: publicProcedure.input(stockOpnameBatchInput).mutation(({ input }) => runMutation("Stock opname", () => db.recordStockOpnameBatch(input))),
    opnameSessions: publicProcedure.input(stockOpnameHistoryInput.optional()).query(({ input }) => db.listStockOpnameSessions(input)),
    updateOpnameFollowUp: publicProcedure.input(stockOpnameFollowUpInput).mutation(({ input }) => runMutation("Tindak lanjut opname", () => db.updateStockOpnameFollowUp(input))),
    updateOpnameFollowUpNote: publicProcedure.input(stockOpnameFollowUpNoteInput).mutation(({ input }) => runMutation("Catatan tindak lanjut opname", () => db.updateStockOpnameFollowUpNote(input))),
  }),
  recipe: router({
    list: publicProcedure.query(() => db.listRecipes()),
    save: publicProcedure.input(recipeInput).mutation(({ input }) => runMutation("Resep", () => db.saveRecipe(input))),
  }),
  dashboard: router({
    dailySettlements: publicProcedure.input(settlementDateRangeInput.optional()).query(({ input }) => db.getDailySettlementSummary(input)),
    financials: publicProcedure.input(settlementDateRangeInput.optional()).query(({ input }) => db.getFinancialDashboard(input)),
    openOpnameSessions: publicProcedure.query(() => db.getOpenStockOpnameSummary()),
  }),
  reports: router({
    monthlySummary: publicProcedure.input(monthlyReportInput).query(({ input }) => runMutation("Laporan bulanan", () => getMonthlyManagementReport(input))),
    monthlyArtifacts: protectedProcedure.input(z.object({ year: z.number().int().min(2000).max(2200).optional(), month: z.number().int().min(1).max(12).optional() }).optional()).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses artefak laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Artefak laporan bulanan", () => listMonthlyReportArtifacts(ctx.user.openId, input));
    }),
    monthlyArtifactGovernance: protectedProcedure.query(({ ctx }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses governance laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Governance artefak laporan", () => getMonthlyReportArtifactGovernanceSummary(ctx.user.openId));
    }),
    monthlyArtifactLifecycleHistory: protectedProcedure.input(z.object({ year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses riwayat lifecycle laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Riwayat lifecycle artefak", () => getMonthlyReportArtifactLifecycleHistory(input.year, input.month, ctx.user.openId));
    }),
    monthlyArtifactGovernanceAuditExport: protectedProcedure.input(z.object({
      year: z.number().int().min(2000).max(2200).optional(),
      month: z.number().int().min(1).max(12).optional(),
      lifecycleStatus: z.enum(["generated", "verified", "retained", "eligible_for_archive", "archived"]).optional(),
      artifactFormat: z.enum(["csv", "html", "pdf"]).optional(),
      artifactScope: z.enum(["active", "archived_or_retired"]).optional(),
    }).optional()).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor audit governance dibatasi untuk pemilik StoreOS." });
      return runMutation("Ekspor audit governance", () => getMonthlyReportArtifactGovernanceAuditExport(ctx.user.openId, input ?? {}));
    }),
    generateMonthlyArtifactGovernanceAuditExport: protectedProcedure.input(z.object({
      year: z.number().int().min(2000).max(2200).optional(),
      month: z.number().int().min(1).max(12).optional(),
      lifecycleStatus: z.enum(["generated", "verified", "retained", "eligible_for_archive", "archived"]).optional(),
      artifactFormat: z.enum(["csv", "html", "pdf"]).optional(),
      artifactScope: z.enum(["active", "archived_or_retired"]).optional(),
      format: z.enum(["csv", "pdf"]),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor audit governance dibatasi untuk pemilik StoreOS." });
      const { format, ...filters } = input;
      return runMutation("Ekspor audit governance", async () => {
        const artifact = await generateGovernanceAuditExportArtifact(ctx.user.openId, filters, format);
        registerGeneratedGovernanceAuditExport(ctx.user.openId, artifact);
        return artifact;
      });
    }),
    verifyMonthlyArtifactGovernanceAuditExport: protectedProcedure.input(z.object({
      exportId: z.string().min(32).max(128),
      bytesBase64: z.string().min(4).max(14_000_000),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi ekspor audit governance dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi ekspor audit governance", () => Promise.resolve(verifyGovernanceAuditExportBytes(input.exportId, input.bytesBase64)));
    }),
    issueMonthlyArtifactGovernanceAuditVerificationReceipt: protectedProcedure.input(z.object({
      exportId: z.string().min(32).max(128),
      bytesBase64: z.string().min(4).max(14_000_000),
      receiptFormat: z.enum(["csv", "pdf"]),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Bukti verifikasi ekspor audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Bukti verifikasi ekspor audit", async () => {
        const policy = await db.getGovernanceAuditQrExpiryPolicy(ctx.user.openId);
        return issueGovernanceAuditVerificationReceipt(ctx.user.openId, { ...input, qrValidityMinutes: policy.validityMinutes });
      });
    }),
    getMonthlyArtifactGovernanceAuditQrExpiryPolicy: protectedProcedure.query(({ ctx }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Pengaturan masa berlaku QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Pengaturan masa berlaku QR", () => db.getGovernanceAuditQrExpiryPolicy(ctx.user.openId));
    }),
    updateMonthlyArtifactGovernanceAuditQrExpiryPolicy: protectedProcedure.input(z.object({
      validityMinutes: z.number().int().min(5).max(10_080),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Pengaturan masa berlaku QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Pengaturan masa berlaku QR", () => db.updateGovernanceAuditQrExpiryPolicy(ctx.user.openId, input.validityMinutes));
    }),
    resolveMonthlyArtifactGovernanceAuditVerificationQr: protectedProcedure.input(z.object({
      referenceId: z.string().regex(/^qr_[a-f0-9]{32}$/),
      exportId: z.string().min(32).max(128),
      receiptId: z.string().min(32).max(160),
    })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi QR ekspor audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi QR ekspor audit", () => Promise.resolve(resolveGovernanceAuditVerificationQr(ctx.user.openId, input)));
    }),
    archiveMonthlyArtifact: protectedProcedure.input(z.object({ year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Arsip laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Arsip artefak laporan", () => archiveMonthlyReportArtifactWithOwnerApproval(input.year, input.month, ctx.user.openId, ctx.user.openId));
    }),
  }),
  sale: router({
    list: publicProcedure.query(() => db.listSales()),
    complete: publicProcedure.input(saleCompletionInput).mutation(({ input }) => runMutation("Penjualan", () => db.completeSale(input))),
    reverse: publicProcedure.input(saleReversalInput).mutation(({ input }) => runMutation("Pembatalan transaksi", () => db.reverseSale(input))),
    partialRefund: publicProcedure.input(partialRefundInput).mutation(({ input }) => runMutation("Refund sebagian", () => db.partialRefundSaleItem(input))),
    exchange: publicProcedure.input(exchangeInput).mutation(({ input }) => runMutation("Penukaran item", () => db.exchangeSaleItem(input))),
    settleExchange: publicProcedure.input(exchangeSettlementInput).mutation(({ input }) => runMutation("Pembayaran penukaran", () => db.settleExchange(input))),
  }),
  settings: router({
    get: publicProcedure.query(() => db.getSettings()),
    update: publicProcedure.input(settingsInput).mutation(({ input }) => runMutation("Pengaturan", () => db.updateSettings(input))),
  }),
});
export type AppRouter = typeof appRouter;
