import { describe, expect, it } from "vitest";
import { filterVarianceRowsByTolerance, sortVarianceRows } from "./varianceToleranceFilter";

describe("filterVarianceRowsByTolerance", () => {
  const rows = [
    { ingredientId: 1, withinTolerance: true },
    { ingredientId: 2, withinTolerance: false },
    { ingredientId: 3, withinTolerance: false },
  ];

  it("retains every row for the default view without mutating the source", () => {
    const result = filterVarianceRowsByTolerance(rows, "all");

    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });

  it("returns only rows that exceed the active tolerance", () => {
    expect(filterVarianceRowsByTolerance(rows, "outside_tolerance").map((row) => row.ingredientId)).toEqual([2, 3]);
  });

  it("orders the largest absolute variance first with deterministic tie breakers", () => {
    const result = sortVarianceRows([
      { ingredientId: 4, ingredientName: "Zat B", variance: 3, varianceExcess: 2 },
      { ingredientId: 2, ingredientName: "Bahan B", variance: -8, varianceExcess: 1 },
      { ingredientId: 1, ingredientName: "Bahan A", variance: 8, varianceExcess: 4 },
      { ingredientId: 3, ingredientName: "Bahan C", variance: -2, varianceExcess: 0 },
    ], "largest_difference");

    expect(result.map((row) => row.ingredientId)).toEqual([1, 2, 4, 3]);
  });

  it("keeps the source order when the default sort is selected", () => {
    const source = [
      { ingredientId: 2, ingredientName: "B", variance: 2, varianceExcess: 0 },
      { ingredientId: 1, ingredientName: "A", variance: 9, varianceExcess: 3 },
    ];

    expect(sortVarianceRows(source, "default").map((row) => row.ingredientId)).toEqual([2, 1]);
  });

  it("supports quick access combination of outside tolerance filter and largest difference sort", () => {
    const rows = [
      { ingredientId: 1, ingredientName: "A", withinTolerance: true, variance: 1, varianceExcess: 0 },
      { ingredientId: 2, ingredientName: "B", withinTolerance: false, variance: -12, varianceExcess: 5 },
      { ingredientId: 3, ingredientName: "C", withinTolerance: false, variance: 5, varianceExcess: 2 },
    ];

    const filtered = filterVarianceRowsByTolerance(rows, "outside_tolerance");
    const sorted = sortVarianceRows(filtered, "largest_difference");

    expect(sorted.map((row) => row.ingredientId)).toEqual([2, 3]);
  });
});
