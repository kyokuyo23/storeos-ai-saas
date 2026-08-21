import { describe, it, expect } from 'vitest';
import { analyzeRepeatedVariances, PeriodVarianceRecord } from './repeatedVariance';

describe('analyzeRepeatedVariances', () => {
  it('correctly identifies repeated high variance across periods', () => {
    const records: PeriodVarianceRecord[] = [
      { periodKey: 'p1', label: 'Minggu Lalu', ingredientId: 10, ingredientName: 'Kopi Arabika', varianceQty: -2, varianceValue: -100000, isOut: true },
      { periodKey: 'p2', label: 'Minggu Ini', ingredientId: 10, ingredientName: 'Kopi Arabika', varianceQty: -3, varianceValue: -150000, isOut: true },
      { periodKey: 'p1', label: 'Minggu Lalu', ingredientId: 11, ingredientName: 'Susu UHT', varianceQty: 0, varianceValue: 0, isOut: false },
      { periodKey: 'p2', label: 'Minggu Ini', ingredientId: 11, ingredientName: 'Susu UHT', varianceQty: -1, varianceValue: -20000, isOut: false },
    ];

    const results = analyzeRepeatedVariances(records, 2);
    expect(results.get(10)?.isRepeatedHighVariance).toBe(true);
    expect(results.get(10)?.outOfTolerancePeriodsCount).toBe(2);
    expect(results.get(11)?.isRepeatedHighVariance).toBe(false);
  });
});
