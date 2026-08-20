export type VarianceToleranceFilter = "all" | "outside_tolerance";

export function filterVarianceRowsByTolerance<T extends { withinTolerance: boolean }>(
  rows: readonly T[],
  filter: VarianceToleranceFilter,
): T[] {
  return filter === "outside_tolerance" ? rows.filter((row) => !row.withinTolerance) : [...rows];
}
