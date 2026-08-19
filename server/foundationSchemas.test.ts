import { describe, expect, it } from "vitest";
import { ingredientInput, productInput, recipeInput } from "./foundationSchemas";

describe("StoreOS Step 2 validation", () => {
  it("rejects an incomplete product", () => {
    expect(productInput.safeParse({ categoryId: 0, name: "", sellingPrice: "abc", costPrice: "", unit: "" }).success).toBe(false);
  });
  it("accepts a complete product and ingredient payload", () => {
    expect(productInput.safeParse({ categoryId: 1, name: "Kopi Susu", sku: "KOP-001", sellingPrice: 18000, costPrice: 7200, unit: "gelas", isActive: true }).success).toBe(true);
    expect(ingredientInput.safeParse({ name: "Susu", unit: "liter", costPerUnit: 22000, minimumStock: 10, isActive: true }).success).toBe(true);
  });
  it("requires a positive-quantity ingredient in a recipe", () => {
    expect(recipeInput.safeParse({ productId: 1, name: "Resep Kopi", items: [] }).success).toBe(false);
    expect(recipeInput.safeParse({ productId: 1, name: "Resep Kopi", items: [{ ingredientId: 2, quantity: 0 }] }).success).toBe(false);
  });
});
