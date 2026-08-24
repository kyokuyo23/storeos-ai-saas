import { expect, test } from "@playwright/test";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const reportFixture = {
  period: {
    label: "Januari 2026",
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

test("downloads a non-empty monthly CSV with exact scope and quoted sections", async ({ page }) => {
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
  await expect(page.getByText("Januari 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-01-01 s/d 2026-01-31 · Asia/Jakarta", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("storeos-monthly-2026-01.csv");
  expect(await download.failure()).toBeNull();

  const directory = await mkdtemp(join(tmpdir(), "storeos-monthly-download-"));
  const downloadedPath = join(directory, download.suggestedFilename());
  await download.saveAs(downloadedPath);
  const fileInfo = await stat(downloadedPath);
  expect(fileInfo.isFile()).toBe(true);
  expect(fileInfo.size).toBeGreaterThan(0);

  const csv = await readFile(downloadedPath, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('"StoreOS Monthly Management Report","Januari 2026"');
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
});
