import { describe, expect, it } from "vitest";
import { mapFoundationError } from "./foundationErrors";
import { stockMovementInput } from "./foundationSchemas";
import { resolveStockMovement } from "./inventory";

describe("stock movement calculation", () => {
  it("adds stock for a purchase and stores its resulting balance", () => expect(resolveStockMovement(4, { type: "purchase", quantity: 2.5 })).toEqual({ quantityDelta: 2.5, balanceAfter: 6.5 }));
  it("deducts stock for waste and rejects negative resulting balances", () => {
    expect(resolveStockMovement(4, { type: "waste", quantity: 1.25 })).toEqual({ quantityDelta: -1.25, balanceAfter: 2.75 });
    expect(() => resolveStockMovement(1, { type: "waste", quantity: 2 })).toThrow("Stok tidak boleh menjadi negatif.");
  });
  it("converts a stock opname count to a delta and resulting balance", () => expect(resolveStockMovement(8, { type: "opname", quantity: 6.5 })).toEqual({ quantityDelta: -1.5, balanceAfter: 6.5 }));
  it("validates movement directions and stock-opname quantities", () => {
    expect(stockMovementInput.safeParse({ ingredientId: 1, type: "purchase", quantity: 0 }).success).toBe(false);
    expect(stockMovementInput.safeParse({ ingredientId: 1, type: "waste", quantity: -1 }).success).toBe(false);
    expect(stockMovementInput.safeParse({ ingredientId: 1, type: "opname", quantity: 0, note: "Penghitungan fisik" }).success).toBe(true);
  });
  it("maps missing ingredients to an explicit invalid-reference error", () => {
    const error = mapFoundationError(new Error("Bahan tidak ditemukan."), "Pergerakan stok");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Bahan tidak ditemukan. Pilih bahan yang tersedia.");
  });
  it("maps unavailable databases to a retryable stock-movement error", () => {
    const error = mapFoundationError(new Error("Database tidak tersedia. Silakan coba lagi."), "Pergerakan stok");
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
