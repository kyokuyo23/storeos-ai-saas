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
