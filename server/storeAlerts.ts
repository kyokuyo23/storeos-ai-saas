/**
 * Store alerts: operational warnings derived only from real store data (no demo data).
 * Pure function so every rule is unit-tested; the router composes it from the database.
 */
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory = "stock" | "menu" | "opname" | "variance" | "shift";

export type StoreAlert = {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
  href: string;
};

export type AlertIngredient = { id: number; name: string; unit: string; currentStock: number; minimumStock: number; isActive: boolean };
export type AlertProduct = { id: number; name: string; isActive: boolean };
export type AlertRecipe = { productId: number; items: Array<{ ingredientId: number; quantity: number }> };
export type AlertOpnameSummary = { openSessionCount: number; needsFollowUpCount: number; oldestOpenSessionReference: string | null; oldestOpenSessionAgeDays: number | null };
export type AlertVarianceRow = { ingredientId: number; ingredientName: string; unit: string; status: "ok" | "over" | "under"; variance: number };
export type AlertThresholds = { opnameWarningAgeDays: number; opnameCriticalAgeDays: number };

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const qty = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);

export function buildStoreAlerts(input: {
  ingredients: AlertIngredient[];
  products: AlertProduct[];
  recipes: AlertRecipe[];
  opname: AlertOpnameSummary | null;
  variance: AlertVarianceRow[];
  thresholds: AlertThresholds;
  /** Phase 2.24: end-of-shift checks with a variance waiting for owner/sysadmin approval. */
  shiftChecks?: { pendingCount: number; oldestAgeHours: number | null };
}): { alerts: StoreAlert[]; counts: Record<AlertSeverity, number> } {
  const alerts: StoreAlert[] = [];
  const ingredientById = new Map(input.ingredients.map((ingredient) => [ingredient.id, ingredient]));

  for (const ingredient of input.ingredients) {
    if (!ingredient.isActive) continue;
    if (ingredient.currentStock <= 0) {
      alerts.push({ id: `stock-out-${ingredient.id}`, severity: "critical", category: "stock", title: `Stok habis: ${ingredient.name}`, detail: `Saldo ${qty(ingredient.currentStock)} ${ingredient.unit}. Produk yang memakai bahan ini tidak bisa dijual.`, href: "/inventory" });
    } else if (ingredient.minimumStock > 0 && ingredient.currentStock <= ingredient.minimumStock) {
      alerts.push({ id: `stock-low-${ingredient.id}`, severity: "warning", category: "stock", title: `Stok menipis: ${ingredient.name}`, detail: `Saldo ${qty(ingredient.currentStock)} ${ingredient.unit}, di bawah/sama dengan minimum ${qty(ingredient.minimumStock)} ${ingredient.unit}.`, href: "/inventory" });
    }
  }

  const recipeByProduct = new Map(input.recipes.map((recipe) => [recipe.productId, recipe]));
  for (const product of input.products) {
    if (!product.isActive) continue;
    const recipe = recipeByProduct.get(product.id);
    if (!recipe || recipe.items.length === 0) {
      alerts.push({ id: `menu-no-recipe-${product.id}`, severity: "warning", category: "menu", title: `Belum bisa dijual: ${product.name}`, detail: "Produk aktif belum memiliki resep, sehingga POS menolak penjualannya.", href: "/products" });
      continue;
    }
    const blockers: string[] = [];
    for (const item of recipe.items) {
      const ingredient = ingredientById.get(item.ingredientId);
      if (!ingredient) blockers.push("bahan resep tidak ditemukan");
      else if (!ingredient.isActive) blockers.push(`${ingredient.name} nonaktif`);
      else if (ingredient.currentStock < item.quantity) blockers.push(`${ingredient.name} kurang (butuh ${qty(item.quantity)} ${ingredient.unit}, ada ${qty(ingredient.currentStock)})`);
    }
    if (blockers.length) {
      alerts.push({ id: `menu-blocked-${product.id}`, severity: "critical", category: "menu", title: `Tidak bisa dijual: ${product.name}`, detail: `Satu porsi pun tidak dapat dibuat: ${blockers.join("; ")}.`, href: "/inventory" });
    }
  }

  if (input.opname && input.opname.openSessionCount > 0) {
    const age = input.opname.oldestOpenSessionAgeDays ?? 0;
    const severity: AlertSeverity = age >= input.thresholds.opnameCriticalAgeDays ? "critical" : age >= input.thresholds.opnameWarningAgeDays ? "warning" : "info";
    alerts.push({ id: "opname-open", severity, category: "opname", title: `${input.opname.openSessionCount} sesi opname belum selesai ditindaklanjuti`, detail: `Sesi tertua ${input.opname.oldestOpenSessionReference ?? "-"} berumur ${age} hari (peringatan ${input.thresholds.opnameWarningAgeDays} hari, mendesak ${input.thresholds.opnameCriticalAgeDays} hari).`, href: "/inventory/opname-history" });
  }

  for (const row of input.variance) {
    if (row.status === "ok") continue;
    alerts.push({ id: `variance-${row.ingredientId}`, severity: "warning", category: "variance", title: `Selisih stok di luar toleransi: ${row.ingredientName}`, detail: `Stok aktual ${row.status === "over" ? "lebih" : "kurang"} ${qty(Math.abs(row.variance))} ${row.unit} dari perhitungan resep dalam 30 hari terakhir.`, href: "/" });
  }

  if (input.shiftChecks && input.shiftChecks.pendingCount > 0) {
    const age = input.shiftChecks.oldestAgeHours ?? 0;
    alerts.push({ id: "shift-check-pending", severity: age > 24 ? "critical" : "warning", category: "shift", title: `${input.shiftChecks.pendingCount} cek akhir shift menunggu persetujuan`, detail: `Ada selisih hitung fisik yang belum ditinjau. Cek tertua dikirim ${age < 1 ? "kurang dari 1 jam" : `${Math.floor(age)} jam`} lalu; stok belum disesuaikan sampai disetujui.`, href: "/shift-check" });
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title, "id"));
  const counts = { critical: 0, warning: 0, info: 0 };
  alerts.forEach((alert) => { counts[alert.severity] += 1; });
  return { alerts, counts };
}
