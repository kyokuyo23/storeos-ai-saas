export type VarianceToleranceFilter = "all" | "outside_tolerance";
export type VarianceSort = "default" | "largest_difference";

export function filterVarianceRowsByTolerance<T extends { withinTolerance: boolean }>(
  rows: readonly T[],
  filter: VarianceToleranceFilter,
): T[] {
  return filter === "outside_tolerance" ? rows.filter((row) => !row.withinTolerance) : [...rows];
}

export function sortVarianceRows<T extends { variance: number; varianceExcess: number; ingredientName: string; ingredientId: number }>(
  rows: readonly T[],
  sort: VarianceSort,
): T[] {
  if (sort === "default") return [...rows];

  return [...rows].sort((left, right) => {
    const varianceDifference = Math.abs(right.variance) - Math.abs(left.variance);
    if (varianceDifference !== 0) return varianceDifference;

    const excessDifference = right.varianceExcess - left.varianceExcess;
    if (excessDifference !== 0) return excessDifference;

    const nameDifference = left.ingredientName.localeCompare(right.ingredientName, "id-ID");
    return nameDifference !== 0 ? nameDifference : left.ingredientId - right.ingredientId;
  });
}
