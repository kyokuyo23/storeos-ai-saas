import { describe, expect, it } from "vitest";
import { planRecipeDeductions } from "./sales";

const recipes = [
  { productId: 1, items: [{ ingredientId: 11, quantity: 0.2 }, { ingredientId: 12, quantity: 18 }] },
  { productId: 2, items: [{ ingredientId: 11, quantity: 0.1 }] },
];

describe("recipe sale deductions", () => {
  it("aggregates multi-ingredient recipe usage across multiple sale lines", () => {
    expect(planRecipeDeductions([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 3 }], recipes, [
      { id: 11, name: "Susu", currentStock: 2 }, { id: 12, name: "Kopi", currentStock: 100 },
    ])).toEqual([
      { ingredientId: 11, ingredientName: "Susu", quantityDelta: -0.7, balanceAfter: 1.3 },
      { ingredientId: 12, ingredientName: "Kopi", quantityDelta: -36, balanceAfter: 64 },
    ]);
  });

  it("rejects insufficient stock before a transaction can be written", () => {
    expect(() => planRecipeDeductions([{ productId: 1, quantity: 2 }], recipes, [
      { id: 11, name: "Susu", currentStock: 0.1 }, { id: 12, name: "Kopi", currentStock: 100 },
    ])).toThrow("Stok bahan tidak mencukupi: Susu.");
  });

  it("rejects products that have no recipe", () => {
    expect(() => planRecipeDeductions([{ productId: 99, quantity: 1 }], recipes, [])).toThrow("Produk belum memiliki resep.");
  });
});
