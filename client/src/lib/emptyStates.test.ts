import { describe, expect, it } from "vitest";
import { inventoryEmptyStates, isCollectionEmpty } from "./emptyStates";

describe("reversal-related empty-state render conditions", () => {
  it("shows the Sales empty state when the persisted sales list is empty", () => {
    expect(isCollectionEmpty([])).toBe(true);
    expect(isCollectionEmpty(undefined)).toBe(true);
    expect(isCollectionEmpty([{ id: 1 }])).toBe(false);
  });

  it("shows both Inventory empty states when persisted ingredient and movement lists are empty", () => {
    expect(inventoryEmptyStates(0, 0)).toEqual({ showIngredientEmptyState: true, showMovementEmptyState: true });
    expect(inventoryEmptyStates(1, 0)).toEqual({ showIngredientEmptyState: false, showMovementEmptyState: true });
  });
});
