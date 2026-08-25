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

async function installArtifactOwnerRoutes(page: import("@playwright/test").Page, artifacts: unknown[], governance = governanceFixture, lifecycleHistory: unknown = null) {
  const owner = { id: 1, openId: "owner-1", name: "Pemilik", role: "admin" };
  await page.route("**/api/trpc/**", async (route) => {
    const procedures = new URL(route.request().url()).pathname.split("/").at(-1)?.split(",") ?? [];
    const result = procedures.map((procedure) => {
      const data = procedure === "auth.me" ? owner
        : procedure === "reports.monthlySummary" ? reportFixture
          : procedure === "reports.monthlyArtifacts" ? artifacts
            : procedure === "reports.monthlyArtifactGovernance" ? governance
              : procedure === "reports.monthlyArtifactLifecycleHistory" ? lifecycleHistory
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
