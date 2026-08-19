export function isCollectionEmpty(items: readonly unknown[] | null | undefined) {
  return !items || items.length === 0;
}

export function inventoryEmptyStates(ingredientCount: number, movementCount: number) {
  return {
    showIngredientEmptyState: ingredientCount === 0,
    showMovementEmptyState: movementCount === 0,
  };
}
