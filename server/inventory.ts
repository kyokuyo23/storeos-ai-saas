import type { z } from "zod";
import type { stockMovementInput } from "./foundationSchemas";

export type StockMovementDraft = z.infer<typeof stockMovementInput>;

export function resolveStockMovement(currentStock: number, input: Pick<StockMovementDraft, "type" | "quantity">) {
  const delta = input.type === "purchase" ? input.quantity
    : input.type === "waste" ? -input.quantity
    : input.type === "opname" ? input.quantity - currentStock
    : input.quantity;
  const balanceAfter = Number((currentStock + delta).toFixed(3));
  if (balanceAfter < 0) throw new Error("Stok tidak boleh menjadi negatif.");
  return { quantityDelta: Number(delta.toFixed(3)), balanceAfter };
}

export type IngredientForOpname = { id: number; name: string; currentStock: number };
export type OpnameCount = { ingredientId: number; physicalQuantity: number };

/** Plans one physical-count session. Zero differences are retained for a complete audit trail. */
export function planStockOpname(ingredients: IngredientForOpname[], counts: OpnameCount[]) {
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const used = new Set<number>();
  return counts.map((count) => {
    if (used.has(count.ingredientId)) throw new Error("Bahan tidak boleh dihitung lebih dari satu kali.");
    used.add(count.ingredientId);
    const ingredient = ingredientById.get(count.ingredientId);
    if (!ingredient) throw new Error("Bahan tidak ditemukan.");
    if (!Number.isFinite(count.physicalQuantity) || count.physicalQuantity < 0) throw new Error("Jumlah fisik tidak boleh negatif.");
    const physicalQuantity = Number(count.physicalQuantity.toFixed(3));
    const quantityDelta = Number((physicalQuantity - ingredient.currentStock).toFixed(3));
    return { ingredientId: ingredient.id, ingredientName: ingredient.name, beforeStock: ingredient.currentStock, physicalQuantity, quantityDelta, balanceAfter: physicalQuantity };
  });
}

export type RecipeForSale = { productId: number; items: Array<{ ingredientId: number; quantity: number }> };
export type SaleLineForPlanning = { productId: number; quantity: number };
export type IngredientForPlanning = { id: number; name: string; currentStock: number };

export function planRecipeDeductions(lines: SaleLineForPlanning[], recipesForSale: RecipeForSale[], ingredientBalances: IngredientForPlanning[]) {
  const recipeByProduct = new Map(recipesForSale.map((recipe) => [recipe.productId, recipe]));
  const demand = new Map<number, number>();
  for (const line of lines) {
    const recipe = recipeByProduct.get(line.productId);
    if (!recipe?.items.length) throw new Error("Produk belum memiliki resep.");
    for (const item of recipe.items) demand.set(item.ingredientId, (demand.get(item.ingredientId) ?? 0) + (item.quantity * line.quantity));
  }
  const ingredientById = new Map(ingredientBalances.map((ingredient) => [ingredient.id, ingredient]));
  return Array.from(demand.entries()).map(([ingredientId, quantity]) => {
    const ingredient = ingredientById.get(ingredientId);
    if (!ingredient) throw new Error("Bahan resep tidak ditemukan.");
    const quantityDelta = Number((-quantity).toFixed(3));
    const balanceAfter = Number((ingredient.currentStock + quantityDelta).toFixed(3));
    if (balanceAfter < 0) throw new Error(`Stok bahan tidak mencukupi: ${ingredient.name}.`);
    return { ingredientId, ingredientName: ingredient.name, quantityDelta, balanceAfter };
  });
}
