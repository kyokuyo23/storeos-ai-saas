import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { isValidGovernanceAuditWibDate } from "./governanceAuditDateSearch";
import { mapFoundationError } from "./foundationErrors";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { categoryInput, exchangeInput, exchangeSettlementInput, ingredientInput, inventoryIntelligenceInput, inventoryMovementDrillDownInput, monthlyReportInput, partialRefundInput, productFinancialInput, productInput, recipeInput, saleCompletionInput, saleReversalInput, settlementDateRangeInput, settingsInput, stockMovementInput, stockOpnameBatchInput, stockOpnameFollowUpInput, stockOpnameFollowUpNoteInput, stockOpnameHistoryInput } from "./foundationSchemas";
import { getMonthlyManagementReport } from "./monthlyReports";
import { archiveMonthlyReportArtifactWithOwnerApproval, canAccessMonthlyReportArtifacts, getMonthlyReportActiveArtifactSummary, getMonthlyReportArtifactGovernanceAuditExport, getMonthlyReportArtifactGovernanceSummary, getMonthlyReportArtifactLifecycleHistory, listMonthlyReportArtifacts } from "./monthlyReportArtifacts";
import { generateGovernanceAuditExportArtifact, registerGeneratedGovernanceAuditExport, verifyGovernanceAuditExportBytes } from "./governanceAuditExportIntegrity";
import { createRetentionSummaryExport, getRetentionSummaryExport, verifyRetentionSummaryExport } from "./retentionSummaryExport";
import { issueGovernanceAuditVerificationReceipt } from "./governanceAuditVerificationReceipts";
import { getGovernanceAuditVerificationQrReference, resolveGovernanceAuditVerificationQr, revokeGovernanceAuditVerificationQrReference } from "./governanceAuditVerificationQr";
import { deriveGovernanceAuditQrReceiptPolicyContext } from "./governanceAuditQrExpiry";
import { GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH } from "./governanceAuditQrRevocation";
import { generateGovernanceAuditQrPolicyAuditArtifact, getGovernanceAuditQrPolicyAuditExport, verifyGovernanceAuditQrPolicyAuditBytes } from "./governanceAuditQrPolicyAuditExport";
import { generateGovernanceAuditQrPolicyReceiptAuditArtifact, getGovernanceAuditQrPolicyReceiptAuditExport, verifyGovernanceAuditQrPolicyReceiptAuditBytes } from "./governanceAuditQrPolicyReceiptAuditExport";

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
    monthlyArtifacts: protectedProcedure.input(z.object({
      year: z.number().int().min(2000).max(2200).optional(),
      month: z.number().int().min(1).max(12).optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["current_month", "previous_month", "last_3_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      format: z.enum(["csv", "html", "pdf"]).optional(),
      integrity: z.literal("healthy").optional(),
      retentionStatus: z.enum(["normal", "approaching", "eligible"]).optional(),
    }).refine((input) => !(input.datePreset && (input.startDate || input.endDate)), { message: "Gunakan preset atau rentang Jakarta/WIB, bukan keduanya." }).refine((input) => !input.startDate && !input.endDate || Boolean(input.startDate && input.endDate), { message: "Rentang Jakarta/WIB harus lengkap." }).optional()).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses artefak laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Artefak laporan bulanan", () => listMonthlyReportArtifacts(ctx.user.openId, input));
    }),
    monthlyArtifactGovernance: protectedProcedure.query(({ ctx }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Akses governance laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Governance artefak laporan", () => getMonthlyReportArtifactGovernanceSummary(ctx.user.openId));
    }),
    monthlyActiveArtifactSummary: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["current_month", "previous_month", "last_3_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
    }).refine((input) => input.datePreset ? !input.startDate && !input.endDate : Boolean(input.startDate && input.endDate), { message: "Gunakan preset review atau rentang Jakarta/WIB lengkap." })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ringkasan artefak laporan dibatasi untuk pemilik StoreOS." });
      return runMutation("Ringkasan artefak aktif", () => getMonthlyReportActiveArtifactSummary(ctx.user.openId, input));
    }),
    createMonthlyRetentionSummaryExport: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["current_month", "previous_month", "last_3_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      format: z.enum(["csv", "html", "pdf"]),
    }).refine((input) => input.datePreset ? !input.startDate && !input.endDate : Boolean(input.startDate && input.endDate), { message: "Gunakan preset review atau rentang Jakarta/WIB lengkap." })
      .refine((input) => (!input.startDate || isValidGovernanceAuditWibDate(input.startDate)) && (!input.endDate || isValidGovernanceAuditWibDate(input.endDate)), { message: "Tanggal review harus tanggal kalender yang valid (YYYY-MM-DD)." })
      .refine((input) => !input.startDate || !input.endDate || input.startDate <= input.endDate, { message: "Tanggal akhir review tidak boleh lebih awal dari tanggal mulai." })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor ringkasan retensi dibatasi untuk pemilik StoreOS." });
      const { format, ...range } = input;
      return runMutation("Ekspor ringkasan retensi", () => createRetentionSummaryExport(ctx.user, range, format));
    }),
    getMonthlyRetentionSummaryExport: protectedProcedure.input(z.object({ exportId: z.string().min(32).max(128) })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor ringkasan retensi dibatasi untuk pemilik StoreOS." });
      return runMutation("Ekspor ringkasan retensi", () => getRetentionSummaryExport(ctx.user, input.exportId));
    }),
    verifyMonthlyRetentionSummaryExport: protectedProcedure.input(z.object({ exportId: z.string().min(32).max(128) })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi ekspor ringkasan retensi dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi ekspor ringkasan retensi", () => verifyRetentionSummaryExport(ctx.user, input.exportId));
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
    monthlyArtifactGovernanceAuditQrPolicyExport: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["today", "last_7_days", "last_30_days", "current_month", "previous_month", "last_3_months", "last_12_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      searchTerm: z.string().min(1).max(160).optional(),
      direction: z.enum(["increase", "decrease", "initial", "no_op"]).optional(),
      actorOpenId: z.string().min(1).max(64).optional(),
      scope: z.literal("governance_audit_qr_expiry").optional(),
    }).optional()).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor audit kebijakan QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Ekspor audit kebijakan QR", () => getGovernanceAuditQrPolicyAuditExport(ctx.user.openId, input ?? {}));
    }),
    generateMonthlyArtifactGovernanceAuditQrPolicyExport: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["today", "last_7_days", "last_30_days", "current_month", "previous_month", "last_3_months", "last_12_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      searchTerm: z.string().min(1).max(160).optional(),
      direction: z.enum(["increase", "decrease", "initial", "no_op"]).optional(),
      actorOpenId: z.string().min(1).max(64).optional(),
      scope: z.literal("governance_audit_qr_expiry").optional(),
      format: z.enum(["csv", "pdf"]),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor audit kebijakan QR dibatasi untuk pemilik StoreOS." });
      const { format, ...filters } = input;
      return runMutation("Ekspor audit kebijakan QR", () => generateGovernanceAuditQrPolicyAuditArtifact(ctx.user.openId, filters, format));
    }),
    verifyMonthlyArtifactGovernanceAuditQrPolicyExport: protectedProcedure.input(z.object({
      exportId: z.string().min(32).max(128),
      bytesBase64: z.string().min(4).max(14_000_000),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi ekspor audit kebijakan QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi ekspor audit kebijakan QR", () => Promise.resolve(verifyGovernanceAuditQrPolicyAuditBytes(input.exportId, input.bytesBase64)));
    }),
    monthlyArtifactGovernanceAuditQrPolicyReceiptExport: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["today", "last_7_days", "last_30_days", "current_month", "previous_month", "last_3_months", "last_12_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      searchTerm: z.string().min(1).max(160).optional(),
      direction: z.enum(["increase", "decrease", "initial", "unchanged"]).optional(),
      actorOpenId: z.string().min(1).max(64).optional(),
      verificationStatus: z.literal("verified").optional(),
      qrStatus: z.enum(["active", "expired", "revoked", "invalid"]).optional(),
      receiptFormat: z.enum(["csv", "pdf"]).optional(),
      scope: z.literal("governance_audit_qr_policy_receipt").optional(),
    }).optional()).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor gabungan kebijakan dan receipt QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Ekspor gabungan kebijakan dan receipt QR", () => getGovernanceAuditQrPolicyReceiptAuditExport(ctx.user.openId, input ?? {}));
    }),
    generateMonthlyArtifactGovernanceAuditQrPolicyReceiptExport: protectedProcedure.input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      datePreset: z.enum(["today", "last_7_days", "last_30_days", "current_month", "previous_month", "last_3_months", "last_12_months", "current_quarter", "previous_quarter", "current_year"]).optional(),
      searchTerm: z.string().min(1).max(160).optional(),
      direction: z.enum(["increase", "decrease", "initial", "unchanged"]).optional(),
      actorOpenId: z.string().min(1).max(64).optional(),
      verificationStatus: z.literal("verified").optional(),
      qrStatus: z.enum(["active", "expired", "revoked", "invalid"]).optional(),
      receiptFormat: z.enum(["csv", "pdf"]).optional(),
      scope: z.literal("governance_audit_qr_policy_receipt").optional(),
      format: z.enum(["csv", "pdf"]),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Ekspor gabungan kebijakan dan receipt QR dibatasi untuk pemilik StoreOS." });
      const { format, ...filters } = input;
      return runMutation("Ekspor gabungan kebijakan dan receipt QR", () => generateGovernanceAuditQrPolicyReceiptAuditArtifact(ctx.user.openId, filters, format));
    }),
    verifyMonthlyArtifactGovernanceAuditQrPolicyReceiptExport: protectedProcedure.input(z.object({
      exportId: z.string().min(32).max(160),
      bytesBase64: z.string().min(4).max(14_000_000),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi ekspor gabungan kebijakan dan receipt QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi ekspor gabungan kebijakan dan receipt QR", () => Promise.resolve(verifyGovernanceAuditQrPolicyReceiptAuditBytes(input.exportId, input.bytesBase64)));
    }),
    issueMonthlyArtifactGovernanceAuditVerificationReceipt: protectedProcedure.input(z.object({
      exportId: z.string().min(32).max(128),
      bytesBase64: z.string().min(4).max(14_000_000),
      receiptFormat: z.enum(["csv", "pdf"]),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Bukti verifikasi ekspor audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Bukti verifikasi ekspor audit", async () => {
        const [policy, history] = await Promise.all([
          db.getGovernanceAuditQrExpiryPolicy(ctx.user.openId),
          db.listGovernanceAuditQrExpiryPolicyHistory(ctx.user.openId),
        ]);
        const qrPolicyContext = deriveGovernanceAuditQrReceiptPolicyContext(policy.validityMinutes, history);
        return issueGovernanceAuditVerificationReceipt(ctx.user.openId, { ...input, qrValidityMinutes: policy.validityMinutes, qrPolicyContext });
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
      return runMutation("Pengaturan masa berlaku QR", () => db.updateGovernanceAuditQrExpiryPolicy(ctx.user.openId, input.validityMinutes, ctx.user.openId));
    }),
    listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory: protectedProcedure.query(({ ctx }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Riwayat kebijakan QR dibatasi untuk pemilik StoreOS." });
      return runMutation("Riwayat kebijakan QR", () => db.listGovernanceAuditQrExpiryPolicyHistory(ctx.user.openId));
    }),
    revokeMonthlyArtifactGovernanceAuditVerificationQr: protectedProcedure.input(z.object({
      referenceId: z.string().regex(/^qr_[a-f0-9]{32}$/),
      exportId: z.string().min(32).max(128),
      receiptId: z.string().min(32).max(160),
      reason: z.string().max(GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH).optional(),
    })).mutation(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Pencabutan QR audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Pencabutan QR audit", async () => {
        const reference = getGovernanceAuditVerificationQrReference(ctx.user.openId, input);
        if (reference.status === "not_found" || reference.status === "invalid_reference") {
          return { outcome: reference.status, message: reference.message } as const;
        }
        const result = await db.revokeGovernanceAuditQrReference({
          ownerOpenId: ctx.user.openId,
          referenceId: input.referenceId,
          exportId: input.exportId,
          receiptId: input.receiptId,
          actorOpenId: ctx.user.openId,
          reason: input.reason,
          previousStatus: reference.status,
        });
        revokeGovernanceAuditVerificationQrReference(input.referenceId);
        return { ...result, message: result.outcome === "revoked" ? "Referensi QR telah dicabut." : "Referensi QR sudah dicabut sebelumnya." };
      });
    }),
    getMonthlyArtifactGovernanceAuditQrRevocation: protectedProcedure.input(z.object({
      referenceId: z.string().regex(/^qr_[a-f0-9]{32}$/),
    })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Riwayat pencabutan QR audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Riwayat pencabutan QR audit", () => db.getGovernanceAuditQrRevocation(ctx.user.openId, input.referenceId));
    }),
    resolveMonthlyArtifactGovernanceAuditVerificationQr: protectedProcedure.input(z.object({
      referenceId: z.string().regex(/^qr_[a-f0-9]{32}$/),
      exportId: z.string().min(32).max(128),
      receiptId: z.string().min(32).max(160),
    })).query(({ ctx, input }) => {
      if (!canAccessMonthlyReportArtifacts(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Verifikasi QR ekspor audit dibatasi untuk pemilik StoreOS." });
      return runMutation("Verifikasi QR ekspor audit", () => resolveGovernanceAuditVerificationQr(ctx.user.openId, input));
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
