import { describe, expect, it } from "vitest";
import { filterVarianceRowsByTolerance } from "./varianceToleranceFilter";

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
});
