import { describe, it, expect } from 'vitest';
import { analyzeRepeatedVariances, PeriodVarianceRecord } from './repeatedVariance';

describe('analyzeRepeatedVariances - 3 Recent Periods Recurrence Rule', () => {
  it('does not flag when fewer than 3 periods exist (rule 5)', () => {
    const records: PeriodVarianceRecord[] = [
      { periodKey: 'p1', label: 'Minggu 1', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -5, varianceValue: -50000, isOut: true },
      { periodKey: 'p2', label: 'Minggu 2', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -5, varianceValue: -50000, isOut: true },
    ];
    const summary = analyzeRepeatedVariances(records);
    expect(summary.get(1)?.isRepeatedHighVariance).toBe(false);
  });

  it('does not flag 0/3 or 1/3 out of tolerance (rule 4)', () => {
    const records: PeriodVarianceRecord[] = [
      { periodKey: 'p1', label: 'P1', ingredientId: 1, ingredientName: 'Kopi', varianceQty: 0, varianceValue: 0, isOut: false },
      { periodKey: 'p2', label: 'P2', ingredientId: 1, ingredientName: 'Kopi', varianceQty: 0, varianceValue: 0, isOut: false },
      { periodKey: 'p3', label: 'P3', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -2, varianceValue: -10000, isOut: true }, // 1 out of 3
    ];
    const summary = analyzeRepeatedVariances(records);
    expect(summary.get(1)?.isRepeatedHighVariance).toBe(false);
  });

  it('flags when 2 of 3 periods are out of tolerance (rule 3)', () => {
    const records: PeriodVarianceRecord[] = [
      { periodKey: 'p1', label: 'P1', ingredientId: 1, ingredientName: 'Kopi', varianceQty: 0, varianceValue: 0, isOut: false },
      { periodKey: 'p2', label: 'P2', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -2, varianceValue: -10000, isOut: true },
      { periodKey: 'p3', label: 'P3', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -3, varianceValue: -15000, isOut: true }, // 2 out of 3
    ];
    const summary = analyzeRepeatedVariances(records);
    expect(summary.get(1)?.isRepeatedHighVariance).toBe(true);
    expect(summary.get(1)?.contextText).toBe('2 dari 3 periode terakhir');
  });

  it('flags when 3 of 3 periods are out of tolerance (rule 3)', () => {
    const records: PeriodVarianceRecord[] = [
      { periodKey: 'p1', label: 'P1', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -1, varianceValue: -5000, isOut: true },
      { periodKey: 'p2', label: 'P2', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -2, varianceValue: -10000, isOut: true },
      { periodKey: 'p3', label: 'P3', ingredientId: 1, ingredientName: 'Kopi', varianceQty: -3, varianceValue: -15000, isOut: true }, // 3 out of 3
    ];
    const summary = analyzeRepeatedVariances(records);
    expect(summary.get(1)?.isRepeatedHighVariance).toBe(true);
    expect(summary.get(1)?.contextText).toBe('3 dari 3 periode terakhir');
  });
});
