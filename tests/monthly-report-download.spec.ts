import { parse } from "csv-parse/sync";
import { expect, test } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

test.describe.configure({ mode: "serial" });

const reportFixture = {
  period: {
    label: "Januari, 2026 — Kopi Nusantara • Cibitung",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    timezone: "Asia/Jakarta",
    year: 2026,
    month: 1,
  },
  financial: {
    grossSales: 125000,
    netRevenue: 115000,
    cogs: 45000,
    grossProfit: 70000,
    grossMargin: 60.869565,
    salesTransactionCount: 4,
    refundValue: 5000,
    voidValue: 5000,
    exchangeImpact: 10000,
  },
  inventory: {
    openingStock: 100,
    closingStock: 82,
    expectedStock: 84,
    actualStock: 82,
    totalVariance: -2,
    outOfToleranceItemCount: 1,
    highValueVarianceCount: 1,
    recurringHighVarianceIngredientCount: 1,
    stockOpnameSessionCount: 2,
    openStockOpnameFollowUpCount: 1,
  },
};

test("downloads a non-empty monthly CSV with exact scope and quoted sections", async ({ page }, testInfo) => {
  await page.route("**/api/trpc/reports.monthlySummary*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ result: { data: { json: reportFixture } } }]),
    });
  });

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Ringkasan Manajemen Bulanan" })).toBeVisible();

  await page.getByLabel("Tahun").selectOption("2026");
  await page.getByLabel("Bulan").selectOption("1");
  await expect(page.getByText("Januari, 2026 — Kopi Nusantara • Cibitung", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-01-01 s/d 2026-01-31 · Asia/Jakarta", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("storeos-monthly-2026-01.csv");
  expect(await download.failure()).toBeNull();

  const downloadedPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(downloadedPath);
  await testInfo.attach("monthly-report-csv", {
    path: downloadedPath,
    contentType: "text/csv; charset=utf-8",
  });
  const fileInfo = await stat(downloadedPath);
  expect(fileInfo.isFile()).toBe(true);
  expect(fileInfo.size).toBeGreaterThan(0);

  const csv = await readFile(downloadedPath, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('"StoreOS Monthly Management Report","Januari, 2026 — Kopi Nusantara • Cibitung"');
  expect(csv).toContain("Januari, 2026 — Kopi Nusantara • Cibitung");
  expect(csv).not.toContain("�");
  expect(csv).toContain('"Periode mulai","2026-01-01"');
  expect(csv).toContain('"Periode akhir","2026-01-31"');
  expect(csv).toContain('"Timezone","Asia/Jakarta"');
  expect(csv).toContain('"Financial","Nilai"');
  expect(csv).toContain('"Inventory","Nilai"');
  expect(csv).toContain('"Net Revenue","115000"');
  expect(csv).toContain('"Recurring High Variance Ingredient Count","1"');
  expect(csv.endsWith("\r\n")).toBe(true);
  expect(csv).not.toContain("2025-12-31");
  expect(csv).not.toContain("2026-02-01");

  const parsedRows = parse(csv, {
    bom: true,
    columns: false,
    relax_column_count: false,
    skip_empty_lines: true,
  }) as string[][];
  expect(parsedRows.every((row) => row.length === 2)).toBe(true);
  expect(parsedRows[0]).toEqual(["StoreOS Monthly Management Report", "Januari, 2026 — Kopi Nusantara • Cibitung"]);
  expect(parsedRows[0]?.[1]).toContain("—");
  expect(parsedRows[0]?.[1]).toContain("•");
  expect(parsedRows[0]?.[0]).not.toContain("\\uFEFF");
  expect(parsedRows[1]).toEqual(["Periode mulai", "2026-01-01"]);
  expect(parsedRows[2]).toEqual(["Periode akhir", "2026-01-31"]);
  expect(parsedRows[3]).toEqual(["Timezone", "Asia/Jakarta"]);
  expect(parsedRows.find((row) => row[0] === "Financial")).toEqual(["Financial", "Nilai"]);
  expect(parsedRows.find((row) => row[0] === "Inventory")).toEqual(["Inventory", "Nilai"]);

  const numericLabels = new Set([
    "Gross Sales",
    "Net Revenue",
    "COGS",
    "Gross Profit",
    "Gross Margin (%)",
    "Sales Transaction Count",
    "Refund Value",
    "Void Value",
    "Exchange Impact",
    "Opening Stock",
    "Closing Stock",
    "Expected Stock",
    "Actual Stock",
    "Total Variance",
    "Out-of-Tolerance Item Count",
    "High-Value Variance Count",
    "Recurring High Variance Ingredient Count",
    "Stock-Opname Session Count",
    "Open Stock-Opname Follow-Up Count",
  ]);
  for (const row of parsedRows) {
    if (numericLabels.has(row[0])) {
      expect(row[1]).not.toBe("");
      expect(Number.isFinite(Number(row[1]))).toBe(true);
    }
  }

  const reportRows = new Map(parsedRows.filter((row) => row[0] && row[1] !== undefined).map((row) => [row[0], row[1]]));
  expect(reportRows.get("StoreOS Monthly Management Report")).toBe("Januari, 2026 — Kopi Nusantara • Cibitung");
  expect(reportRows.get("Periode mulai")).toBe("2026-01-01");
  expect(reportRows.get("Periode akhir")).toBe("2026-01-31");
  expect(reportRows.get("Net Revenue")).toBe("115000");
  expect(reportRows.get("Recurring High Variance Ingredient Count")).toBe("1");
});

const storedArtifactFixture = {
  id: 42,
  year: 2026,
  month: 1,
  timezone: "Asia/Jakarta",
  periodStartDate: "2026-01-01",
  periodEndDate: "2026-01-31",
  generatedAt: "2026-02-01T00:15:00.000Z",
  csv: { kind: "csv", bytes: 93, sha256: "a".repeat(64), status: "available" },
  printableHtml: { kind: "html", bytes: 210, sha256: "b".repeat(64), status: "available" },
  pdf: { kind: "pdf", bytes: 512, sha256: "c".repeat(64), status: "available" },
};

const governanceFixture = {
  retentionMonths: 24,
  archiveWarningWindowDays: 90,
  retainedArtifactCount: 2,
  artifactTypeCounts: { csv: 2, html: 2, pdf: 2 },
  oldestRetainedReport: { year: 2024, month: 10, generatedAt: "2024-11-01T00:15:00.000Z" },
  approachingArchive: [{ year: 2024, month: 10, generatedAt: "2024-11-01T00:15:00.000Z", lifecycleStatus: "eligible_for_archive", daysUntilArchive: 0 }],
  lifecycleCounts: { generated: 0, verified: 0, retained: 1, eligible_for_archive: 1, archived: 3 },
  integrityCounts: { available: 6, missing: 0, corrupt: 0, retired: 0, archived: 0 },
};

const lifecycleHistoryFixture = {
  artifact: { ...storedArtifactFixture, lifecycleStatus: "archived" },
  events: [
    { lifecycleStatus: "generated", occurredAt: "2026-02-01T00:15:00.000Z", source: "scheduler", actor: "cron:storeos-monthly-management-report", artifactFormat: "CSV, HTML, PDF", reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, integrity: [{ kind: "csv", bytes: 93, sha256: "a".repeat(64) }, { kind: "pdf", bytes: 512, sha256: "c".repeat(64) }], reason: "Artefak laporan berhasil dibuat." },
    { lifecycleStatus: "verified", occurredAt: "2026-02-01T00:15:02.000Z", source: "integrity-check", actor: "system", artifactFormat: "CSV, HTML, PDF", reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, integrity: [{ kind: "csv", bytes: 93, sha256: "a".repeat(64) }], reason: "Checksum SHA-256 tervalidasi." },
    { lifecycleStatus: "retained", occurredAt: "2026-02-01T00:15:03.000Z", source: "retention-policy", actor: "system", artifactFormat: "CSV, HTML, PDF", reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, integrity: [{ kind: "html", bytes: 210, sha256: "b".repeat(64) }], reason: "Artefak aktif dalam masa retensi." },
    { lifecycleStatus: "eligible_for_archive", occurredAt: "2028-01-31T00:15:00.000Z", source: "retention-policy", actor: "system", artifactFormat: "CSV, HTML, PDF", reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, integrity: [{ kind: "pdf", bytes: 512, sha256: "c".repeat(64) }], reason: "Memenuhi ambang arsip." },
    { lifecycleStatus: "archived", occurredAt: "2028-02-01T00:15:00.000Z", source: "archive-policy", actor: "system", artifactFormat: "CSV, HTML, PDF", reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, integrity: [{ kind: "csv", bytes: 93, sha256: "a".repeat(64) }], reason: "Binary dinonaktifkan; metadata audit dipertahankan." },
  ],
};

const governanceAuditExportFixture = {
  kind: "storeos_governance_lifecycle_audit",
  version: 1,
  generatedAt: "2026-08-25T03:15:00.000Z",
  timezone: "Asia/Jakarta",
  filters: { year: null, month: null, lifecycleStatus: null, artifactFormat: null, artifactScope: null },
  recordCount: 2,
  records: [
    { reportPeriod: { year: 2024, month: 10, timezone: "Asia/Jakarta" }, lifecycleStatus: "archived", occurredAt: "2026-08-25T03:00:00.000Z", source: "owner_archive_action", actor: "owner-1", transitionReason: "owner_approved_archive, checksum tervalidasi", eventArtifactFormat: "bundle", artifactFormat: "pdf", bytes: 512, sha256: "a".repeat(64), integritySnapshotStatus: "recorded", artifactScope: "archived", currentLifecycleStatus: "archived", archiveEligibleAt: "2026-08-24T03:00:00.000Z", archivedAt: "2026-08-25T03:00:00.000Z", retiredAt: "2026-08-25T03:00:00.000Z", archiveReason: "owner_approved_archive" },
    { reportPeriod: { year: 2026, month: 1, timezone: "Asia/Jakarta" }, lifecycleStatus: "retained", occurredAt: "2026-02-01T00:15:03.000Z", source: "report_generation", actor: "storeos-system", transitionReason: "monthly_report_retained", eventArtifactFormat: "bundle", artifactFormat: "csv", bytes: 93, sha256: "b".repeat(64), integritySnapshotStatus: "recorded", artifactScope: "active", currentLifecycleStatus: "retained", archiveEligibleAt: null, archivedAt: null, retiredAt: null, archiveReason: null },
  ],
};

const governanceAuditExactCsv = "\ufeff\"Tahun\",\"Bulan\",\"Lifecycle event\",\"Waktu event (WIB)\",\"Sumber\",\"Aktor\",\"Format event\",\"Format artefak\",\"Ukuran byte\",\"SHA-256\",\"Status snapshot integritas\",\"Scope artefak\",\"Lifecycle saat ini\",\"Eligible arsip (WIB)\",\"Diarsipkan (WIB)\",\"Diretir (WIB)\",\"Alasan arsip\",\"Scope filter\",\"Metadata transisi\"\r\n\"2024\",\"10\",\"archived\",\"25 Agu 2026 10.00 WIB\",\"owner_archive_action\",\"owner-1\",\"bundle\",\"pdf\",\"512\",\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"recorded\",\"archived\",\"archived\",\"24 Agu 2026 10.00 WIB\",\"25 Agu 2026 10.00 WIB\",\"25 Agu 2026 10.00 WIB\",\"owner_approved_archive\",\"periode=semua; lifecycle=archived; format=semua; status artefak=semua\",\"owner_approved_archive, checksum tervalidasi\"\r\n";
const governanceAuditExactCsvBytes = Buffer.from(governanceAuditExactCsv, "utf8");
const governanceAuditIntegrityCsvFixture = {
  exportId: `storeos-governance-audit-csv-${"d".repeat(64)}`,
  format: "csv",
  filename: "storeos-governance-audit-all-archived-all-all.csv",
  contentType: "text/csv;charset=utf-8",
  bytesBase64: governanceAuditExactCsvBytes.toString("base64"),
  byteSize: governanceAuditExactCsvBytes.byteLength,
  sha256: "d".repeat(64),
  generatedAt: "2026-08-25T03:15:00.000Z",
  timezone: "Asia/Jakarta",
  scope: "periode=semua; lifecycle=archived; format=semua; status artefak=semua",
  recordCount: 2,
};
const governanceAuditIntegrityPdfFixture = {
  ...governanceAuditIntegrityCsvFixture,
  exportId: `storeos-governance-audit-pdf-${"e".repeat(64)}`,
  format: "pdf",
  filename: "storeos-governance-audit-all-archived-all-all.pdf",
  contentType: "application/pdf",
  bytesBase64: Buffer.from("%PDF-1.4\nStoreOS Governance Audit\n%%EOF", "utf8").toString("base64"),
  byteSize: Buffer.byteLength("%PDF-1.4\nStoreOS Governance Audit\n%%EOF"),
  sha256: "e".repeat(64),
};
const governanceAuditReceiptPolicyFixture = {
  validityMinutes: 90,
  previousValidityMinutes: 30,
  differenceMinutes: 60,
  change: "increase",
  policyEventId: "qrph_browser_increase",
  issuedAt: "2026-08-26T01:20:00.000Z",
  expiresAt: "2026-08-26T02:50:00.000Z",
};
const governanceAuditReceiptCsvBytes = Buffer.from(`\ufeff"StoreOS Governance Audit Verification Receipt","v1"\r\n"Export ID","${governanceAuditIntegrityCsvFixture.exportId}"\r\n"SHA-256 export","${governanceAuditIntegrityCsvFixture.sha256}"\r\n"Status verifikasi","verified"\r\n"Masa berlaku QR (menit)","90"\r\n"Masa berlaku sebelumnya (menit)","30"\r\n"Perubahan kebijakan","increase"\r\n"Perbedaan (menit)","60"\r\n"Referensi event kebijakan","qrph_browser_increase"\r\n`, "utf8");
const governanceAuditQrFixture = {
  version: 1,
  referenceId: `qr_${"9".repeat(32)}`,
  exportId: governanceAuditIntegrityCsvFixture.exportId,
  receiptId: `storeos-governance-audit-receipt-${governanceAuditIntegrityCsvFixture.exportId}`,
  verificationStatus: "verified",
  issuedAt: "2026-08-26T01:20:00.000Z",
  expiresAt: "2026-08-26T01:50:00.000Z",
  payload: JSON.stringify({ version: 1, referenceId: `qr_${"9".repeat(32)}`, exportId: governanceAuditIntegrityCsvFixture.exportId, receiptId: `storeos-governance-audit-receipt-${governanceAuditIntegrityCsvFixture.exportId}`, verificationStatus: "verified" }),
  verificationUrl: `/verify?ref=qr_${"9".repeat(32)}&export=${governanceAuditIntegrityCsvFixture.exportId}&receipt=storeos-governance-audit-receipt-${governanceAuditIntegrityCsvFixture.exportId}&status=verified`,
  imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Jr0sAAAAASUVORK5CYII=",
};
const governanceAuditReceiptCsvFixture = {
  receiptId: `storeos-governance-audit-receipt-${governanceAuditIntegrityCsvFixture.exportId}`,
  receiptFormat: "csv",
  filename: "storeos-governance-audit-verification-receipt.csv",
  contentType: "text/csv;charset=utf-8",
  verificationAt: "2026-08-26T01:20:00.000Z",
  export: { exportId: governanceAuditIntegrityCsvFixture.exportId, format: "csv", generatedAt: governanceAuditIntegrityCsvFixture.generatedAt, timezone: "Asia/Jakarta", scope: governanceAuditIntegrityCsvFixture.scope, recordCount: 2, byteSize: governanceAuditIntegrityCsvFixture.byteSize, sha256: governanceAuditIntegrityCsvFixture.sha256 },
  verification: { verified: true, status: "verified", expectedSha256: governanceAuditIntegrityCsvFixture.sha256, actualSha256: governanceAuditIntegrityCsvFixture.sha256, byteSize: governanceAuditIntegrityCsvFixture.byteSize },
  receiptByteSize: governanceAuditReceiptCsvBytes.byteLength,
  receiptSha256: "c".repeat(64),
  qr: governanceAuditQrFixture,
  policy: governanceAuditReceiptPolicyFixture,
  bytesBase64: governanceAuditReceiptCsvBytes.toString("base64"),
};
const governanceAuditReceiptPdfFixture = {
  ...governanceAuditReceiptCsvFixture,
  receiptFormat: "pdf",
  filename: "storeos-governance-audit-verification-receipt.pdf",
  contentType: "application/pdf",
  receiptByteSize: Buffer.byteLength("%PDF-1.4\nStoreOS Governance Audit Verification Receipt\n%%EOF"),
  receiptSha256: "f".repeat(64),
  bytesBase64: Buffer.from("%PDF-1.4\nStoreOS Governance Audit Verification Receipt\n%%EOF", "utf8").toString("base64"),
};
const governanceAuditQrPolicyAuditFixture = {
  kind: "storeos_governance_qr_policy_audit",
  version: 1,
  generatedAt: "2026-08-26T01:15:00.000Z",
  timezone: "Asia/Jakarta",
  filters: { startDate: null, endDate: null, direction: null, actorOpenId: null, scope: "governance_audit_qr_expiry", dateBoundary: "start_inclusive_end_exclusive_wib" },
  recordCount: 2,
  records: [
    { eventId: "qrph_browser_90", previousValidityMinutes: 30, newValidityMinutes: 90, deltaMinutes: 60, direction: "increase", result: "updated", changedAt: "2026-08-26T02:10:00.000Z", actorOpenId: "owner-1", scope: "governance_audit_qr_expiry" },
    { eventId: "qrph_browser_45", previousValidityMinutes: 90, newValidityMinutes: 45, deltaMinutes: -45, direction: "decrease", result: "updated", changedAt: "2026-08-25T17:30:00.000Z", actorOpenId: "owner-1", scope: "governance_audit_qr_expiry" },
  ],
};
const governanceAuditQrPolicyAuditCsvBytes = Buffer.from("\ufeff\"StoreOS QR Policy Audit Snapshot Export\",\"v1\"\r\n\"ID event kebijakan\",\"Arah\"\r\n\"qrph_browser_90\",\"increase\"\r\n", "utf8");
const governanceAuditQrPolicyAuditCsvFixture = {
  kind: "storeos_governance_qr_policy_audit_export", version: 1,
  exportId: `storeos-qr-policy-audit-csv-${"a".repeat(64)}`,
  format: "csv", filename: "storeos-qr-policy-audit-all-all-all.csv", contentType: "text/csv;charset=utf-8",
  generatedAt: governanceAuditQrPolicyAuditFixture.generatedAt, timezone: "Asia/Jakarta", filters: governanceAuditQrPolicyAuditFixture.filters,
  scope: "tanggal=semua s.d. semua WIB; arah=semua; aktor=semua; scope=governance_audit_qr_expiry", recordCount: 2,
  byteSize: governanceAuditQrPolicyAuditCsvBytes.byteLength, sha256: "a".repeat(64), bytesBase64: governanceAuditQrPolicyAuditCsvBytes.toString("base64"),
};
const governanceAuditQrPolicyAuditPdfFixture = {
  ...governanceAuditQrPolicyAuditCsvFixture, exportId: `storeos-qr-policy-audit-pdf-${"b".repeat(64)}`, format: "pdf", filename: "storeos-qr-policy-audit-all-all-all.pdf", contentType: "application/pdf",
  bytesBase64: Buffer.from("%PDF-1.4\nStoreOS QR Policy Audit Snapshot\n%%EOF", "utf8").toString("base64"), byteSize: Buffer.byteLength("%PDF-1.4\nStoreOS QR Policy Audit Snapshot\n%%EOF"), sha256: "b".repeat(64),
};
const governanceAuditQrPolicyReceiptAuditFixture = {
  kind: "storeos_governance_qr_policy_receipt_audit",
  version: 1,
  generatedAt: "2026-08-27T01:15:00.000Z",
  timezone: "Asia/Jakarta",
  filters: { startDate: null, endDate: null, direction: null, actorOpenId: null, verificationStatus: null, qrStatus: null, receiptFormat: null, scope: "governance_audit_qr_policy_receipt", dateBoundary: "start_inclusive_end_exclusive_wib" },
  recordCount: 4,
  records: [
    { correlationId: "receipt-browser-active", receiptId: "receipt-browser-active", receiptIssuedAt: "2026-08-27T01:00:00.000Z", receiptFormat: "csv", receiptVerificationStatus: "verified", receiptSha256: "a".repeat(64), receiptByteSize: 418, policyEventId: "qrph_browser_increase", policyPreviousValidityMinutes: 30, policyValidityMinutes: 90, policyDifferenceMinutes: 60, policyDirection: "increase", policyActorOpenId: "owner-1", policyChangedAt: "2026-08-26T02:10:00.000Z", policyCorrelation: "matched_policy_event", policyLabel: "Matched policy event", sourceExportId: "source-active", sourceFormat: "csv", sourceScope: "governance_audit", sourceSha256: "b".repeat(64), sourceByteSize: 782, qrReferenceId: `qr_${"1".repeat(32)}`, qrIssuedAt: "2026-08-27T01:00:00.000Z", qrExpiresAt: "2026-08-27T02:30:00.000Z", qrStatus: "active" },
    { correlationId: "receipt-browser-revoked", receiptId: "receipt-browser-revoked", receiptIssuedAt: "2026-08-27T00:45:00.000Z", receiptFormat: "pdf", receiptVerificationStatus: "verified", receiptSha256: "c".repeat(64), receiptByteSize: 620, policyEventId: "qrph_browser_decrease", policyPreviousValidityMinutes: 90, policyValidityMinutes: 45, policyDifferenceMinutes: -45, policyDirection: "decrease", policyActorOpenId: "owner-1", policyChangedAt: "2026-08-26T01:30:00.000Z", policyCorrelation: "matched_policy_event", policyLabel: "Matched policy event", sourceExportId: "source-revoked", sourceFormat: "pdf", sourceScope: "governance_audit", sourceSha256: "d".repeat(64), sourceByteSize: 913, qrReferenceId: `qr_${"2".repeat(32)}`, qrIssuedAt: "2026-08-27T00:45:00.000Z", qrExpiresAt: "2026-08-27T02:00:00.000Z", qrStatus: "revoked" },
    { correlationId: "receipt-browser-expired", receiptId: "receipt-browser-expired", receiptIssuedAt: "2026-08-26T01:00:00.000Z", receiptFormat: "csv", receiptVerificationStatus: "verified", receiptSha256: "e".repeat(64), receiptByteSize: 417, policyEventId: "qrph_browser_increase", policyPreviousValidityMinutes: 30, policyValidityMinutes: 90, policyDifferenceMinutes: 60, policyDirection: "increase", policyActorOpenId: "owner-1", policyChangedAt: "2026-08-26T02:10:00.000Z", policyCorrelation: "matched_policy_event", policyLabel: "Matched policy event", sourceExportId: "source-expired", sourceFormat: "csv", sourceScope: "governance_audit", sourceSha256: "f".repeat(64), sourceByteSize: 781, qrReferenceId: `qr_${"3".repeat(32)}`, qrIssuedAt: "2026-08-26T01:00:00.000Z", qrExpiresAt: "2026-08-26T01:30:00.000Z", qrStatus: "expired" },
    { correlationId: "receipt-browser-initial", receiptId: "receipt-browser-initial", receiptIssuedAt: "2026-08-25T01:00:00.000Z", receiptFormat: "csv", receiptVerificationStatus: "verified", receiptSha256: "0".repeat(64), receiptByteSize: 415, policyEventId: null, policyPreviousValidityMinutes: null, policyValidityMinutes: 30, policyDifferenceMinutes: 0, policyDirection: "initial", policyActorOpenId: null, policyChangedAt: null, policyCorrelation: "initial_policy", policyLabel: "Initial policy — no previous policy.", sourceExportId: "source-initial", sourceFormat: "csv", sourceScope: "governance_audit", sourceSha256: "9".repeat(64), sourceByteSize: 779, qrReferenceId: null, qrIssuedAt: null, qrExpiresAt: null, qrStatus: "invalid" },
  ],
};
const governanceAuditQrPolicyReceiptAuditCsvBytes = Buffer.from("\ufeff\"StoreOS Combined QR Policy & Receipt Audit Export\",\"v1\"\r\n\"Receipt ID\",\"Policy changedAt (WIB)\",\"Status QR\"\r\n\"receipt-browser-active\",\"26 Agu 2026 09.10 WIB\",\"active\"\r\n", "utf8");
const governanceAuditQrPolicyReceiptAuditCsvFixture = {
  kind: "storeos_governance_qr_policy_receipt_audit_export", version: 1,
  exportId: `storeos-qr-policy-receipt-audit-csv-${"6".repeat(64)}`,
  format: "csv", filename: "storeos-qr-policy-receipt-audit-2026-08-increase-active-csv.csv", contentType: "text/csv;charset=utf-8",
  generatedAt: governanceAuditQrPolicyReceiptAuditFixture.generatedAt, timezone: "Asia/Jakarta", filters: governanceAuditQrPolicyReceiptAuditFixture.filters,
  scope: "tanggal=2026-08-01 s.d. 2026-08-31 WIB; arah=increase; aktor=owner-1; status QR=active; format receipt=csv; scope=governance_audit_qr_policy_receipt", recordCount: 1,
  byteSize: governanceAuditQrPolicyReceiptAuditCsvBytes.byteLength, sha256: "6".repeat(64), bytesBase64: governanceAuditQrPolicyReceiptAuditCsvBytes.toString("base64"),
};
const governanceAuditQrPolicyReceiptAuditPdfFixture = {
  ...governanceAuditQrPolicyReceiptAuditCsvFixture, exportId: `storeos-qr-policy-receipt-audit-pdf-${"7".repeat(64)}`, format: "pdf", filename: "storeos-qr-policy-receipt-audit-2026-08-increase-active-csv.pdf", contentType: "application/pdf",
  bytesBase64: Buffer.from("%PDF-1.4\nStoreOS Combined QR Policy & Receipt Audit\n%%EOF", "utf8").toString("base64"), byteSize: Buffer.byteLength("%PDF-1.4\nStoreOS Combined QR Policy & Receipt Audit\n%%EOF"), sha256: "7".repeat(64),
};

async function installArtifactOwnerRoutes(
  page: import("@playwright/test").Page,
  artifacts: unknown[],
  governance = governanceFixture,
  lifecycleHistory: unknown = null,
  archiveResult: unknown = { outcome: "archived", artifact: { id: 42, year: 2024, month: 10, lifecycleStatus: "archived" }, availability: [], archivedAt: "2026-08-25T00:00:00.000Z" },
  onArchive?: () => void,
  governanceAuditExport: unknown = governanceAuditExportFixture,
  governanceAuditVerification: unknown = { verified: true, status: "verified", byteSize: governanceAuditIntegrityCsvFixture.byteSize, expectedSha256: governanceAuditIntegrityCsvFixture.sha256, actualSha256: governanceAuditIntegrityCsvFixture.sha256 },
  governanceAuditReceipt: unknown = { status: "issued", receipt: governanceAuditReceiptCsvFixture },
  governanceAuditQrVerification: unknown = { status: "verified", exportId: governanceAuditIntegrityCsvFixture.exportId, receiptId: governanceAuditQrFixture.receiptId, scope: governanceAuditIntegrityCsvFixture.scope, format: "csv", generatedAt: governanceAuditIntegrityCsvFixture.generatedAt, generatedAtWib: "25 Agu 2026 10.15 WIB", issuedAt: governanceAuditQrFixture.issuedAt, issuedAtWib: "26 Agu 2026 08.20 WIB", expiresAt: governanceAuditQrFixture.expiresAt, expiresAtWib: "26 Agu 2026 08.50 WIB", verifiedAt: "2026-08-26T01:20:00.000Z", verifiedAtWib: "26 Agu 2026 08.20 WIB", byteSize: governanceAuditIntegrityCsvFixture.byteSize, sha256: governanceAuditIntegrityCsvFixture.sha256, verificationStatus: "verified" },
  governanceAuditQrExpiryPolicy: { ownerOpenId: string; validityMinutes: number } = { ownerOpenId: "owner-1", validityMinutes: 30 },
  onQrExpiryPolicyUpdate?: (validityMinutes: number) => void,
  qrRevocationWorkflow?: { issuedAt?: string; revocation?: unknown; onRevoke?: (reason: string | null) => void },
  qrExpiryPolicyHistory: Array<{ eventId: string; previousValidityMinutes: number; newValidityMinutes: number; resultingValidityMinutes: number; changedAt: string; actorOpenId: string }> = [],
  governanceAuditQrPolicyAudit: unknown = governanceAuditQrPolicyAuditFixture,
  governanceAuditQrPolicyAuditVerification: unknown = { verified: true, status: "verified", byteSize: governanceAuditQrPolicyAuditCsvFixture.byteSize, expectedSha256: governanceAuditQrPolicyAuditCsvFixture.sha256, actualSha256: governanceAuditQrPolicyAuditCsvFixture.sha256 },
  governanceAuditQrPolicyReceiptAudit: unknown = governanceAuditQrPolicyReceiptAuditFixture,
  governanceAuditQrPolicyReceiptAuditVerification: unknown = { verified: true, status: "verified", byteSize: governanceAuditQrPolicyReceiptAuditCsvFixture.byteSize, expectedSha256: governanceAuditQrPolicyReceiptAuditCsvFixture.sha256, actualSha256: governanceAuditQrPolicyReceiptAuditCsvFixture.sha256 },
) {
  const owner = { id: 1, openId: "owner-1", name: "Pemilik", role: "admin" };
  let qrExpiryValidityMinutes = governanceAuditQrExpiryPolicy.validityMinutes;
  const qrExpiryHistory = [...qrExpiryPolicyHistory];
  let qrRevocation = qrRevocationWorkflow?.revocation ?? null;
  await page.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname.split("/").at(-1)?.split(",") ?? [];
    const encodedRequest = decodeURIComponent(`${route.request().url()} ${route.request().postData() ?? ""}`);
    const requestedAuditFormat = encodedRequest.includes('"format":"pdf"') ? "pdf" : "csv";
    const requestedReceiptFormat = encodedRequest.includes('"receiptFormat":"pdf"') ? "pdf" : "csv";
    const requestedQrExpiry = Number(encodedRequest.match(/"validityMinutes":(\d+)/)?.[1]);
    const requestedQrRevocationReason = encodedRequest.match(/"reason":"([^"\\]*(?:\\.[^"\\]*)*)"/)?.[1] ?? null;
    const qrExpiryChanged = procedures.includes("reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy") && Number.isInteger(requestedQrExpiry) && requestedQrExpiry !== qrExpiryValidityMinutes;
    if (procedures.includes("reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy") && Number.isInteger(requestedQrExpiry)) {
      if (qrExpiryChanged) qrExpiryHistory.unshift({ eventId: `qrph_browser_${requestedQrExpiry}`, previousValidityMinutes: qrExpiryValidityMinutes, newValidityMinutes: requestedQrExpiry, resultingValidityMinutes: requestedQrExpiry, changedAt: "2026-08-26T02:10:00.000Z", actorOpenId: "owner-1" });
      qrExpiryValidityMinutes = requestedQrExpiry;
      onQrExpiryPolicyUpdate?.(requestedQrExpiry);
    }
    const receiptQr = {
      ...governanceAuditQrFixture,
      issuedAt: qrRevocationWorkflow?.issuedAt ?? governanceAuditQrFixture.issuedAt,
      expiresAt: new Date(new Date(qrRevocationWorkflow?.issuedAt ?? governanceAuditQrFixture.issuedAt).getTime() + qrExpiryValidityMinutes * 60_000).toISOString(),
    };
    if (procedures.includes("reports.revokeMonthlyArtifactGovernanceAuditVerificationQr")) {
      qrRevocation = { referenceId: governanceAuditQrFixture.referenceId, revokedAt: "2026-08-26T02:00:00.000Z", actorOpenId: "owner-1", reason: requestedQrRevocationReason, previousStatus: "verified", resultingStatus: "revoked" };
      qrRevocationWorkflow?.onRevoke?.(requestedQrRevocationReason);
    }
    const result = procedures.map((procedure) => {
      const data = procedure === "auth.me" ? owner
        : procedure === "reports.monthlySummary" ? reportFixture
          : procedure === "reports.monthlyArtifacts" ? artifacts
            : procedure === "reports.monthlyArtifactGovernance" ? governance
              : procedure === "reports.monthlyArtifactLifecycleHistory" ? lifecycleHistory
                : procedure === "reports.monthlyArtifactGovernanceAuditExport" ? governanceAuditExport
                    : procedure === "reports.generateMonthlyArtifactGovernanceAuditExport" ? (requestedAuditFormat === "pdf" ? governanceAuditIntegrityPdfFixture : governanceAuditIntegrityCsvFixture)
                        : procedure === "reports.verifyMonthlyArtifactGovernanceAuditExport" ? governanceAuditVerification
                          : procedure === "reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt" ? (typeof governanceAuditReceipt === "object" && governanceAuditReceipt && "status" in governanceAuditReceipt && (governanceAuditReceipt as { status?: string }).status === "issued" ? { status: "issued", receipt: requestedReceiptFormat === "pdf" ? { ...governanceAuditReceiptPdfFixture, qr: receiptQr } : { ...governanceAuditReceiptCsvFixture, qr: receiptQr } } : governanceAuditReceipt)
                            : procedure === "reports.resolveMonthlyArtifactGovernanceAuditVerificationQr" ? governanceAuditQrVerification
                            : procedure === "reports.getMonthlyArtifactGovernanceAuditQrRevocation" ? qrRevocation
                              : procedure === "reports.revokeMonthlyArtifactGovernanceAuditVerificationQr" ? { outcome: "revoked", revocation: qrRevocation }
                              : procedure === "reports.getMonthlyArtifactGovernanceAuditQrExpiryPolicy" ? { ownerOpenId: "owner-1", validityMinutes: qrExpiryValidityMinutes }
                              : procedure === "reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory" ? qrExpiryHistory
                              : procedure === "reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy" ? { ownerOpenId: "owner-1", validityMinutes: qrExpiryValidityMinutes, outcome: qrExpiryChanged ? "updated" : "unchanged" }
                              : procedure === "reports.monthlyArtifactGovernanceAuditQrPolicyExport" ? governanceAuditQrPolicyAudit
                              : procedure === "reports.generateMonthlyArtifactGovernanceAuditQrPolicyExport" ? (requestedAuditFormat === "pdf" ? governanceAuditQrPolicyAuditPdfFixture : governanceAuditQrPolicyAuditCsvFixture)
                              : procedure === "reports.verifyMonthlyArtifactGovernanceAuditQrPolicyExport" ? governanceAuditQrPolicyAuditVerification
                              : procedure === "reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport" ? governanceAuditQrPolicyReceiptAudit
                              : procedure === "reports.generateMonthlyArtifactGovernanceAuditQrPolicyReceiptExport" ? (requestedAuditFormat === "pdf" ? governanceAuditQrPolicyReceiptAuditPdfFixture : governanceAuditQrPolicyReceiptAuditCsvFixture)
                              : procedure === "reports.verifyMonthlyArtifactGovernanceAuditQrPolicyReceiptExport" ? governanceAuditQrPolicyReceiptAuditVerification
                            : procedure === "reports.archiveMonthlyArtifact" ? (onArchive?.(), archiveResult)
              : undefined;
      return data === undefined ? { error: { json: { message: `Unhandled test procedure: ${procedure}`, code: -32601, data: { code: "NOT_FOUND", httpStatus: 404 } } } } : { result: { data: { json: data } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
}

test("shows the owner-visible stored-artifact empty state", async ({ page }) => {
  await installArtifactOwnerRoutes(page, []);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Ringkasan Manajemen Bulanan" })).toBeVisible();
  await expect(page.getByText("Belum ada artefak tersimpan untuk filter ini.")).toBeVisible();
  await expect(page.getByText("Artefak akan muncul setelah laporan bulanan periode selesai dibuat dan melewati verifikasi integritas.")).toBeVisible();
});

test("renders owner-admin artifact governance counts, lifecycle, and archive threshold", async ({ page }) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Governance artefak laporan" })).toBeVisible();
  await expect(page.getByText("Artefak aktif tersimpan")).toBeVisible();
  await expect(page.getByText("2 CSV · 2 PDF · 2 HTML")).toBeVisible();
  await expect(page.getByText("Oktober 2024").first()).toBeVisible();
  await expect(page.getByText("Integritas artefak aktif sehat")).toBeVisible();
  await expect(page.getByText("Siap arsip 1")).toBeVisible();
  await expect(page.getByText("Mendekati ambang retensi")).toBeVisible();
  await expect(page.getByText("Memenuhi syarat arsip")).toBeVisible();
  await expect(page.getByText(/Lifecycle: Dihasilkan/)).toBeVisible();
});

test("shows chronological archived lifecycle history with WIB metadata and integrity snapshots", async ({ page }) => {
  await installArtifactOwnerRoutes(page, [{ ...storedArtifactFixture, lifecycleStatus: "archived" }], governanceFixture, lifecycleHistoryFixture);
  await page.goto("/reports");
  await page.getByRole("button", { name: "Riwayat Lifecycle" }).click();
  const history = page.getByLabel("Riwayat Lifecycle Januari 2026");
  await expect(history).toBeVisible();
  await expect(history.getByText("Lifecycle saat ini")).toBeVisible();
  await expect(history.getByText("Diarsipkan").first()).toBeVisible();
  await expect(history.getByText("Snapshot integritas").first()).toBeVisible();
  await expect(history.getByText("scheduler · cron:storeos-monthly-management-report")).toBeVisible();
  await expect(history.getByText("Januari 2026 · Asia/Jakarta").first()).toBeVisible();
  expect(await history.getByText(/WIB/).count()).toBeGreaterThan(1);
  await expect(history.locator(".lifecycle-event")).toHaveCount(5);
  await expect(history.locator(".lifecycle-event").nth(0)).toContainText("Dihasilkan");
  await expect(history.locator(".lifecycle-event").nth(4)).toContainText("Diarsipkan");
});

test("shows a lifecycle-history empty state without exposing a download path", async ({ page }) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, { artifact: { ...storedArtifactFixture, lifecycleStatus: "retained" }, events: [] });
  await page.goto("/reports");
  await page.getByRole("button", { name: "Riwayat Lifecycle" }).click();
  const history = page.getByLabel("Riwayat Lifecycle Januari 2026");
  await expect(history.getByText("Belum ada event lifecycle.")).toBeVisible();
  await expect(history.getByText("Riwayat akan terisi secara deterministik ketika metadata artefak melewati transisi lifecycle.")).toBeVisible();
  await expect(history.getByRole("button", { name: /Unduh/ })).toHaveCount(0);
});

test("downloads a checksum-verified stored CSV through the controlled report endpoint", async ({ page }, testInfo) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  const storedCsv = "\ufeff\"StoreOS Managed Artifact\",\"Januari 2026\"\r\n\"Integrity\",\"verified\"\r\n";
  const artifactRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("monthly-artifacts")) artifactRequests.push(request.url()); });
  await page.context().route("**/*", async (route) => {
    if (!route.request().url().includes("/api/reports/monthly-artifacts/2026/1/csv")) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      headers: { "content-disposition": "attachment; filename=\"storeos-management-report-2026-01.csv\"", "cache-control": "no-store" },
      body: storedCsv,
    });
  });
  await page.goto("/reports");
  await expect(page.getByText("Terverifikasi").first()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh CSV" }).click();
  const download = await downloadPromise;
  expect(artifactRequests).toEqual(["http://127.0.0.1:4173/api/reports/monthly-artifacts/2026/1/csv"]);
  expect(download.suggestedFilename()).toBe("storeos-management-report-2026-01.csv");
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const data = await readFile(path, "utf8");
  expect(data.charCodeAt(0)).toBe(0xfeff);
  expect(data).toContain('"Integrity","verified"');
  expect((await stat(path)).size).toBeGreaterThan(0);
});

test("shows the owner-approved archive confirmation only for eligible artifacts and records an explicit approval", async ({ page }) => {
  const eligibleArtifact = {
    ...storedArtifactFixture,
    id: 77,
    year: 2024,
    month: 10,
    periodStartDate: "2024-10-01",
    periodEndDate: "2024-10-31",
    generatedAt: "2024-11-01T00:15:00.000Z",
    lifecycleStatus: "eligible_for_archive",
  };
  let archiveCalls = 0;
  await installArtifactOwnerRoutes(page, [{ ...storedArtifactFixture, lifecycleStatus: "retained" }, eligibleArtifact], governanceFixture, null, undefined, () => { archiveCalls += 1; });
  await page.goto("/reports");

  await expect(page.getByRole("button", { name: "Arsipkan" })).toHaveCount(1);
  await page.getByRole("button", { name: "Arsipkan" }).click();
  const confirmation = page.getByLabel("Konfirmasi arsip Oktober 2024");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText("Arsipkan Oktober 2024?")).toBeVisible();
  await expect(confirmation.getByText(/Usia retensi: sekitar \d+ bulan/)).toBeVisible();
  await expect(confirmation.getByText(/SHA-256 dan ukuran CSV, HTML, serta PDF/)).toBeVisible();
  await expect(confirmation.getByText("Unduhan aktif akan dinonaktifkan.")).toBeVisible();

  await confirmation.getByRole("button", { name: "Setujui & Arsipkan" }).click();
  await expect(confirmation.getByText("Artefak berhasil diarsipkan. Metadata dan riwayat lifecycle tetap dipertahankan.")).toBeVisible();
  expect(archiveCalls).toBe(1);
});

test("shows an integrity failure without changing the browser-side approval control into a false success", async ({ page }) => {
  const eligibleArtifact = { ...storedArtifactFixture, year: 2024, month: 9, generatedAt: "2024-10-01T00:15:00.000Z", lifecycleStatus: "eligible_for_archive" };
  await installArtifactOwnerRoutes(page, [eligibleArtifact], governanceFixture, null, { outcome: "integrity_failed", artifact: { id: 42, year: 2024, month: 9, lifecycleStatus: "eligible_for_archive" }, availability: [{ kind: "pdf", status: "corrupt", bytes: 512, sha256: "c".repeat(64) }], archivedAt: null });
  await page.goto("/reports");
  await page.getByRole("button", { name: "Arsipkan" }).click();
  const confirmation = page.getByLabel("Konfirmasi arsip September 2024");
  await confirmation.getByRole("button", { name: "Setujui & Arsipkan" }).click();
  await expect(confirmation.getByRole("alert")).toContainText("Pengarsipan ditolak karena integritas artefak tidak dapat diverifikasi.");
  await expect(confirmation.getByText("Artefak berhasil diarsipkan. Metadata dan riwayat lifecycle tetap dipertahankan.")).toHaveCount(0);
});

test("keeps the archive confirmation usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const eligibleArtifact = { ...storedArtifactFixture, year: 2024, month: 8, generatedAt: "2024-09-01T00:15:00.000Z", lifecycleStatus: "eligible_for_archive" };
  await installArtifactOwnerRoutes(page, [eligibleArtifact]);
  await page.goto("/reports");
  await page.getByRole("button", { name: "Arsipkan" }).click();
  const confirmation = page.getByLabel("Konfirmasi arsip Agustus 2024");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Batalkan" })).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Setujui & Arsipkan" })).toBeVisible();
  const box = await confirmation.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(358);
});

test("filters, downloads, and prints the owner-admin governance audit with scoped lifecycle metadata", async ({ page }, testInfo) => {
  const auditRequests: string[] = [];
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  page.on("request", (request) => {
    if (request.url().includes("reports.monthlyArtifactGovernanceAuditExport")) auditRequests.push(decodeURIComponent(request.url()));
  });
  await page.goto("/reports");
  const panel = page.locator(".governance-audit-export-panel");
  await expect(page.getByRole("heading", { name: "Ekspor Audit Governance" })).toBeVisible();
  await expect(page.getByText("2 record", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Tahun audit governance")).toBeVisible();
  await expect(page.getByText("owner_archive_action · owner-1")).toBeVisible();
  await expect(page.getByText(/SHA-256 a{12}/)).toBeVisible();

  await page.getByLabel("Lifecycle audit governance").selectOption("archived");
  await expect.poll(() => auditRequests.length).toBeGreaterThan(1);
  expect(auditRequests.at(-1)).toContain('"lifecycleStatus":"archived"');

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV Audit" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(governanceAuditIntegrityCsvFixture.filename);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  expect(await readFile(path)).toEqual(governanceAuditExactCsvBytes);
  const csv = await readFile(path, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const parsed = parse(csv, { bom: true, columns: false, relax_column_count: false, skip_empty_lines: false }) as string[][];
  expect(parsed.every((row) => row.length === 19)).toBe(true);
  expect(parsed.find((row) => row[0] === "Tahun")).toContain("Metadata transisi");
  expect(parsed.find((row) => row[0] === "2024" && row[2] === "archived")?.[18]).toBe("owner_approved_archive, checksum tervalidasi");
  const integrity = panel.getByLabel("Integritas ekspor audit governance");
  await expect(integrity).toBeVisible();
  await expect(integrity.getByLabel("SHA-256 ekspor audit governance")).toHaveValue("d".repeat(64));
  await expect(integrity).toContainText(`${governanceAuditExactCsvBytes.byteLength} byte`);
  await expect(integrity).toContainText("periode=semua; lifecycle=archived; format=semua; status artefak=semua");
  await expect(integrity).toContainText("Terverifikasi server");

  const pdfDownloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "PDF Audit" }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toBe(governanceAuditIntegrityPdfFixture.filename);
  const pdfPath = testInfo.outputPath(pdfDownload.suggestedFilename());
  await pdfDownload.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
  await expect(integrity.getByLabel("SHA-256 ekspor audit governance")).toHaveValue("e".repeat(64));
});

test("shows governance audit empty and error states without exposing raw artifact paths", async ({ page }) => {
  await installArtifactOwnerRoutes(page, [], governanceFixture, null, undefined, undefined, { ...governanceAuditExportFixture, recordCount: 0, records: [] });
  await page.goto("/reports");
  await expect(page.getByText("Tidak ada event lifecycle untuk filter ini.")).toBeVisible();
  await expect(page.getByText(/CSV audit tetap dapat diunduh sebagai bukti filter/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("monthly-management-reports/");

  await page.unroute("**/api/trpc/**");
  await page.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname.split("/").at(-1)?.split(",") ?? [];
    const result = procedures.map((procedure) => procedure === "reports.monthlyArtifactGovernanceAuditExport"
      ? { error: { json: { message: "Akses owner-admin ditolak", code: -32003, data: { code: "FORBIDDEN", httpStatus: 403 } } } }
      : { result: { data: { json: procedure === "auth.me" ? { id: 1, openId: "owner-1", name: "Pemilik", role: "admin" } : procedure === "reports.monthlySummary" ? reportFixture : procedure === "reports.monthlyArtifacts" ? [] : procedure === "reports.monthlyArtifactGovernance" ? governanceFixture : null } } });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.reload();
  await expect(page.getByText("Ekspor audit governance tidak tersedia atau akses owner-admin ditolak.")).toBeVisible();
});

test("shows an explicit integrity warning when server verification detects tampered audit export bytes", async ({ page }) => {
  const mismatch = { verified: false, status: "hash_mismatch", byteSize: governanceAuditIntegrityCsvFixture.byteSize, expectedSha256: governanceAuditIntegrityCsvFixture.sha256, actualSha256: "f".repeat(64) };
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, null, undefined, undefined, governanceAuditExportFixture, mismatch);
  await page.goto("/reports");
  await page.getByRole("button", { name: "CSV Audit" }).click();
  const integrity = page.getByLabel("Integritas ekspor audit governance");
  await expect(integrity.getByRole("status")).toContainText("HASH TIDAK COCOK");
  await expect(integrity.getByRole("button", { name: "Verifikasi ulang" })).toBeVisible();
  await expect(integrity.getByRole("button", { name: "Bukti CSV" })).toBeDisabled();
  await expect(integrity.getByRole("button", { name: "Bukti PDF" })).toBeDisabled();
  await expect(page.getByLabel("Referensi QR verifikasi audit")).toHaveCount(0);
});

test("downloads owner-admin verification receipts only after the exact export bytes are server-verified", async ({ page }, testInfo) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  const integrity = page.getByLabel("Integritas ekspor audit governance");

  await page.getByRole("button", { name: "CSV Audit" }).click();
  await expect(integrity.getByRole("status")).toContainText("Terverifikasi server");
  await expect(integrity.getByRole("button", { name: "Bukti CSV" })).toBeEnabled();
  const receiptDownloadPromise = page.waitForEvent("download");
  await integrity.getByRole("button", { name: "Bukti CSV" }).click();
  const receiptDownload = await receiptDownloadPromise;
  expect(receiptDownload.suggestedFilename()).toBe(governanceAuditReceiptCsvFixture.filename);
  const receiptPath = testInfo.outputPath(receiptDownload.suggestedFilename());
  await receiptDownload.saveAs(receiptPath);
  const receipt = await readFile(receiptPath, "utf8");
  expect(receipt.charCodeAt(0)).toBe(0xfeff);
  expect(receipt).toContain(governanceAuditIntegrityCsvFixture.exportId);
  expect(receipt).toContain(governanceAuditIntegrityCsvFixture.sha256);
  expect(receipt).toContain("Masa berlaku QR (menit)");
  expect(receipt).toContain("qrph_browser_increase");
  await expect(integrity.getByText(/^Bukti verifikasi CSV diunduh/)).toBeVisible();

  const receiptPolicy = page.getByLabel("Snapshot kebijakan QR pada receipt");
  await expect(receiptPolicy).toContainText("90 menit");
  await expect(receiptPolicy).toContainText("30 menit");
  await expect(receiptPolicy).toContainText("Meningkat · +60 menit");
  await expect(receiptPolicy).toContainText("qrph_browser_increase");

  const pdfReceiptPromise = page.waitForEvent("download");
  await integrity.getByRole("button", { name: "Bukti PDF" }).click();
  const pdfReceipt = await pdfReceiptPromise;
  expect(pdfReceipt.suggestedFilename()).toBe(governanceAuditReceiptPdfFixture.filename);
  const pdfReceiptPath = testInfo.outputPath(pdfReceipt.suggestedFilename());
  await pdfReceipt.saveAs(pdfReceiptPath);
  expect((await readFile(pdfReceiptPath)).subarray(0, 5).toString()).toBe("%PDF-");
});

test("issues a safe QR reference only from a verified receipt and resolves checksum metadata without artifact download", async ({ page }) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  const integrity = page.getByLabel("Integritas ekspor audit governance");

  await page.getByRole("button", { name: "CSV Audit" }).click();
  await expect(integrity.getByRole("status")).toContainText("Terverifikasi server");
  const receiptDownloadPromise = page.waitForEvent("download");
  await integrity.getByRole("button", { name: "Bukti CSV" }).click();
  await receiptDownloadPromise;

  const qr = page.getByLabel("Referensi QR verifikasi audit");
  await expect(qr).toBeVisible();
  await expect(qr.getByText("Referensi QR terverifikasi")).toBeVisible();
  await expect(qr.getByText(governanceAuditQrFixture.referenceId, { exact: true })).toBeVisible();
  await expect(qr.getByRole("img", { name: "QR untuk referensi verifikasi audit" })).toHaveAttribute("src", /^data:image\/png;base64,/);
  const verifyLink = qr.getByRole("link", { name: "Buka hasil verifikasi QR" });
  await expect(verifyLink).toHaveAttribute("href", /\/verify\?ref=qr_[a-f0-9]{32}&export=storeos-governance-audit-csv-/);

  await verifyLink.click();
  await expect(page.getByRole("heading", { name: "Verifikasi referensi QR" })).toBeVisible();
  const result = page.getByLabel("Verifikasi QR Governance Audit");
  await expect(result.getByText("Checksum ekspor terverifikasi")).toBeVisible();
  await expect(result).toContainText(governanceAuditIntegrityCsvFixture.exportId);
  await expect(result).toContainText(governanceAuditIntegrityCsvFixture.sha256);
  await expect(result).toContainText("Diterbitkan");
  await expect(result).toContainText("Berlaku sampai");
  await expect(result.getByRole("button", { name: /Unduh/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("monthly-management-reports/");
});

test("filters, downloads, and re-verifies the combined policy and receipt audit from exact server bytes", async ({ page }, testInfo) => {
  const auditRequests: string[] = [];
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  page.on("request", (request) => {
    if (request.url().includes("reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport")) auditRequests.push(decodeURIComponent(request.url()));
  });
  await page.goto("/reports");
  const audit = page.getByLabel("Ekspor Gabungan Policy & Receipt");
  await expect(audit).toContainText("Receipt tersaring");
  await expect(audit).toContainText("4 record");
  await expect(audit).toContainText("Indeks owner persisten");
  await expect(audit).toContainText("Tahan restart · tanpa byte receipt");
  await expect(audit).toContainText("Status QR: active");
  await expect(audit).toContainText("Bukti: tersimpan");
  await expect(audit).toContainText("qrph_browser_increase");
  await audit.getByLabel("Tanggal mulai audit gabungan QR").fill("2026-08-01");
  await audit.getByLabel("Tanggal akhir audit gabungan QR").fill("2026-08-31");
  await audit.getByLabel("Arah audit gabungan QR").selectOption("increase");
  await audit.getByLabel("Aktor audit gabungan QR").fill("owner-1");
  await audit.getByLabel("Status receipt audit gabungan QR").selectOption("verified");
  await audit.getByLabel("Status QR audit gabungan").selectOption("active");
  await audit.getByLabel("Format receipt audit gabungan QR").selectOption("csv");
  await expect.poll(() => auditRequests.some((request) => request.includes('"startDate":"2026-08-01"') && request.includes('"endDate":"2026-08-31"') && request.includes('"direction":"increase"') && request.includes('"actorOpenId":"owner-1"') && request.includes('"verificationStatus":"verified"') && request.includes('"qrStatus":"active"') && request.includes('"receiptFormat":"csv"') && request.includes('"scope":"governance_audit_qr_policy_receipt"'))).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await audit.getByRole("button", { name: "CSV Gabungan" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(governanceAuditQrPolicyReceiptAuditCsvFixture.filename);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes).toEqual(governanceAuditQrPolicyReceiptAuditCsvBytes);
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(bytes.toString("utf8")).toContain("Status QR");

  const integrity = page.getByLabel("Integritas ekspor gabungan policy dan receipt QR");
  await expect(integrity).toBeVisible();
  await expect(integrity.getByLabel("SHA-256 ekspor gabungan policy dan receipt QR")).toHaveValue("6".repeat(64));
  await expect(integrity).toContainText(`${governanceAuditQrPolicyReceiptAuditCsvBytes.byteLength} byte`);
  await expect(integrity).toContainText("status QR=active");
  await expect(integrity.getByRole("status")).toContainText("Terverifikasi server");
  await integrity.getByRole("button", { name: "Verifikasi ulang" }).click();
  await expect(integrity.getByRole("status")).toContainText("SHA-256 cocok");

  const pdfDownloadPromise = page.waitForEvent("download");
  await audit.getByRole("button", { name: "PDF Gabungan" }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toBe(governanceAuditQrPolicyReceiptAuditPdfFixture.filename);
  const pdfPath = testInfo.outputPath(pdfDownload.suggestedFilename());
  await pdfDownload.saveAs(pdfPath);
  expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
});

test("shows combined audit empty and owner-admin error states without raw storage paths", async ({ page }) => {
  await installArtifactOwnerRoutes(
    page,
    [],
    governanceFixture,
    null,
    undefined, // archiveResult
    undefined, // onArchive
    undefined, // governanceAuditExport
    undefined, // governanceAuditVerification
    undefined, // governanceAuditReceipt
    undefined, // governanceAuditQrVerification
    undefined, // governanceAuditQrExpiryPolicy
    undefined, // onQrExpiryPolicyUpdate
    undefined, // qrRevocationWorkflow
    undefined, // qrExpiryPolicyHistory
    undefined, // governanceAuditQrPolicyAudit
    undefined, // governanceAuditQrPolicyAuditVerification
    { ...governanceAuditQrPolicyReceiptAuditFixture, recordCount: 0, records: [] },
  );
  await page.goto("/reports");
  const audit = page.getByLabel("Ekspor Gabungan Policy & Receipt");
  await expect(audit.getByText("Tidak ada receipt persisted yang sesuai dengan filter saat ini. Receipt yang tidak tersedia atau gagal dimuat tidak diperlakukan sebagai record valid; ekspor snapshot kosong tetap dapat dibuat dan diverifikasi.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("monthly-management-reports/");

  await page.unroute("**/api/trpc/**");
  await page.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname.split("/").at(-1)?.split(",") ?? [];
    const result = procedures.map((procedure) => procedure === "reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport"
      ? { error: { json: { message: "Akses owner-admin ditolak", code: -32003, data: { code: "FORBIDDEN", httpStatus: 403 } } } }
      : { result: { data: { json: procedure === "auth.me" ? { id: 1, openId: "owner-1", name: "Pemilik", role: "admin" } : procedure === "reports.monthlySummary" ? reportFixture : procedure === "reports.monthlyArtifacts" ? [] : procedure === "reports.monthlyArtifactGovernance" ? governanceFixture : null } } });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.reload();
  await expect(page.getByText("Audit gabungan QR tidak tersedia, metadata receipt gagal uji integritas, atau akses owner-admin ditolak.")).toBeVisible();
});

test("keeps the combined audit controls readable and actionable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  const audit = page.getByLabel("Ekspor Gabungan Policy & Receipt");
  await expect(audit.getByLabel("Status QR audit gabungan")).toBeVisible();
  await expect(audit.getByRole("button", { name: "CSV Gabungan" })).toBeVisible();
  await expect(audit.getByRole("button", { name: "PDF Gabungan" })).toBeVisible();
  const box = await audit.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(358);
});

test("filters, downloads, and re-verifies an owner-admin QR policy audit export from exact server bytes", async ({ page }, testInfo) => {
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  const audit = page.getByLabel("Ekspor Audit Kebijakan QR");
  await expect(audit).toContainText("Riwayat tersaring");
  await expect(audit).toContainText("2 event");
  await audit.getByLabel("Arah audit kebijakan QR").selectOption("increase");
  await audit.getByLabel("Aktor audit kebijakan QR").fill("owner-1");
  await expect(audit).toContainText("qrph_browser_90");
  const downloadPromise = page.waitForEvent("download");
  await audit.getByRole("button", { name: "CSV Kebijakan" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(governanceAuditQrPolicyAuditCsvFixture.filename);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(bytes.toString("utf8")).toContain("qrph_browser_90");
  const integrity = page.getByLabel("Integritas ekspor audit kebijakan QR");
  await expect(integrity.getByLabel("SHA-256 ekspor audit kebijakan QR")).toHaveValue("a".repeat(64));
  await expect(integrity.getByRole("status")).toContainText("Terverifikasi server");
  await integrity.getByRole("button", { name: "Verifikasi ulang" }).click();
  await expect(integrity.getByRole("status")).toContainText("SHA-256 cocok");
});

test("allows the owner-admin to persist a bounded QR expiry policy and applies it only to the newly issued receipt", async ({ page }) => {
  const policyUpdates: number[] = [];
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, null, undefined, undefined, governanceAuditExportFixture, undefined, undefined, undefined, { ownerOpenId: "owner-1", validityMinutes: 30 }, (validityMinutes) => policyUpdates.push(validityMinutes));
  await page.goto("/reports");
  await page.getByRole("button", { name: "CSV Audit" }).click();
  const integrity = page.getByLabel("Integritas ekspor audit governance");
  const policyHistory = page.getByLabel("Riwayat Kebijakan QR");
  await expect(policyHistory).toContainText("Belum ada perubahan kebijakan QR");
  const expiryInput = integrity.getByLabel("Masa berlaku QR dalam menit");
  await expect(expiryInput).toHaveValue("30");
  await expiryInput.fill("90");
  await integrity.getByRole("button", { name: "Simpan durasi" }).click();
  await expect(integrity.getByText("Masa berlaku QR baru disimpan: 90 menit", { exact: false })).toBeVisible();
  await expect(expiryInput).toHaveValue("90");
  expect(policyUpdates).toEqual([90]);
  await expect(policyHistory).toContainText("30 → 90 menit");
  await expect(policyHistory).toContainText("oleh owner-1");
  await expect(policyHistory).toContainText("WIB");
  await expect(policyHistory.locator(".governance-qr-policy-history-list li")).toHaveCount(1);
  await integrity.getByRole("button", { name: "Simpan durasi" }).click();
  await expect(integrity.getByText("Tidak ada event riwayat baru", { exact: false })).toBeVisible();
  await expect(policyHistory.locator(".governance-qr-policy-history-list li")).toHaveCount(1);

  const receiptDownloadPromise = page.waitForEvent("download");
  await integrity.getByRole("button", { name: "Bukti CSV" }).click();
  await receiptDownloadPromise;
  const qr = page.getByLabel("Referensi QR verifikasi audit");
  await expect(qr).toContainText("Diterbitkan");
  await expect(qr).toContainText("Berlaku sampai");
  await expect(qr).toContainText("26/8/2026");
});

test("shows issued and expiry metadata for an expired QR and does not expose artifact downloads", async ({ page }) => {
  const expired = {
    status: "expired",
    message: "Referensi QR verifikasi telah kedaluwarsa. Buat dan verifikasi ulang ekspor audit.",
    issuedAt: governanceAuditQrFixture.issuedAt,
    issuedAtWib: "26 Agu 2026 08.20 WIB",
    expiresAt: governanceAuditQrFixture.expiresAt,
    expiresAtWib: "26 Agu 2026 08.50 WIB",
  };
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, null, undefined, undefined, governanceAuditExportFixture, undefined, undefined, expired);
  await page.goto(`/verify?ref=${governanceAuditQrFixture.referenceId}&export=${governanceAuditIntegrityCsvFixture.exportId}&receipt=${governanceAuditQrFixture.receiptId}&status=verified`);
  const result = page.getByLabel("Verifikasi QR Governance Audit");
  await expect(result.getByText("Referensi QR kedaluwarsa")).toBeVisible();
  await expect(result).toContainText("Diterbitkan");
  await expect(result).toContainText("Berakhir");
  await expect(result).toContainText("Kedaluwarsa — verifikasi tidak diterima");
  await expect(result.getByRole("button", { name: /Unduh/ })).toHaveCount(0);
});

test("allows an owner-admin to revoke an active QR once and exposes the audited revoked state without an artifact download", async ({ page }) => {
  const reasons: Array<string | null> = [];
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, null, undefined, undefined, governanceAuditExportFixture, undefined, undefined, undefined, { ownerOpenId: "owner-1", validityMinutes: 30 }, undefined, { issuedAt: "2027-08-26T01:20:00.000Z", onRevoke: (reason) => reasons.push(reason) });
  await page.goto("/reports");
  await page.getByRole("button", { name: "CSV Audit" }).click();
  const integrity = page.getByLabel("Integritas ekspor audit governance");
  const receiptDownloadPromise = page.waitForEvent("download");
  await integrity.getByRole("button", { name: "Bukti CSV" }).click();
  await receiptDownloadPromise;

  const qr = page.getByLabel("Referensi QR verifikasi audit");
  await qr.getByRole("button", { name: "Cabut QR" }).click();
  const confirmation = page.getByLabel("Konfirmasi pencabutan QR");
  await expect(confirmation).toContainText("Agustus 2026");
  await expect(confirmation).toContainText(governanceAuditIntegrityCsvFixture.exportId);
  await expect(confirmation).toContainText(governanceAuditQrFixture.referenceId);
  await expect(confirmation).toContainText("tidak akan lagi lolos verifikasi");
  await confirmation.getByLabel("Alasan pencabutan QR").fill("Distribusi salah tujuan");
  await confirmation.getByRole("button", { name: "Konfirmasi cabut QR" }).click();
  await expect(qr.getByText("Referensi QR dicabut. QR ini tidak akan lagi lolos verifikasi.")).toBeVisible();
  await expect(qr.getByText("QR dicabut", { exact: true })).toBeVisible();
  await expect(qr).toContainText("Dicabut");
  await expect(qr).toContainText("oleh owner-1");
  await expect(qr).toContainText("Alasan: Distribusi salah tujuan");
  await expect(qr.getByRole("button", { name: "Cabut QR" })).toHaveCount(0);
  await expect(qr.getByRole("link", { name: "Buka hasil verifikasi QR" })).toBeVisible();
  expect(reasons).toEqual(["Distribusi salah tujuan"]);
});

test("shows revoked resolver metadata without an artifact download and keeps revoke controls readable on mobile", async ({ page }) => {
  const revoked = { status: "revoked", message: "Referensi QR verifikasi telah dicabut oleh owner-admin.", referenceId: governanceAuditQrFixture.referenceId, exportId: governanceAuditIntegrityCsvFixture.exportId, issuedAt: governanceAuditQrFixture.issuedAt, issuedAtWib: "26 Agu 2026 08.20 WIB", expiresAt: governanceAuditQrFixture.expiresAt, expiresAtWib: "26 Agu 2026 08.50 WIB", revokedAt: "2026-08-26T02:00:00.000Z", revokedAtWib: "26 Agu 2026 09.00 WIB", actorOpenId: "owner-1", reason: "Distribusi salah tujuan", previousStatus: "verified", resultingStatus: "revoked" };
  await installArtifactOwnerRoutes(page, [storedArtifactFixture], governanceFixture, null, undefined, undefined, governanceAuditExportFixture, undefined, undefined, revoked, { ownerOpenId: "owner-1", validityMinutes: 30 }, undefined, { issuedAt: "2027-08-26T01:20:00.000Z" });
  await page.goto(`/verify?ref=${governanceAuditQrFixture.referenceId}&export=${governanceAuditIntegrityCsvFixture.exportId}&receipt=${governanceAuditQrFixture.receiptId}&status=verified`);
  const result = page.getByLabel("Verifikasi QR Governance Audit");
  await expect(result.getByText("Referensi QR dicabut")).toBeVisible();
  await expect(result).toContainText("Dicabut");
  await expect(result).toContainText("owner-1");
  await expect(result).toContainText("Distribusi salah tujuan");
  await expect(result.getByRole("button", { name: /Unduh/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reports");
  await page.getByRole("button", { name: "CSV Audit" }).click();
  const receiptDownloadPromise = page.waitForEvent("download");
  await page.getByLabel("Integritas ekspor audit governance").getByRole("button", { name: "Bukti CSV" }).click();
  await receiptDownloadPromise;
  const qr = page.getByLabel("Referensi QR verifikasi audit");
  await expect(qr.getByRole("button", { name: "Cabut QR" })).toBeVisible();
  const box = await qr.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(358);
});

test("keeps governance audit filters and export actions readable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installArtifactOwnerRoutes(page, [storedArtifactFixture]);
  await page.goto("/reports");
  const heading = page.getByRole("heading", { name: "Ekspor Audit Governance" });
  const panel = page.locator(".governance-audit-export-panel");
  await expect(heading).toBeVisible();
  await expect(panel.getByRole("button", { name: "CSV Audit" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "PDF Audit" })).toBeVisible();
  await panel.getByRole("button", { name: "CSV Audit" }).click();
  await expect(panel.getByLabel("Masa berlaku QR dalam menit")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Simpan durasi" })).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(358);
});
