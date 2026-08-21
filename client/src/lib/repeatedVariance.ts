export interface PeriodVarianceRecord {
  periodKey: string;
  label: string;
  ingredientId: number;
  ingredientName: string;
  varianceQty: number;
  varianceValue: number;
  isOut: boolean;
}

export interface RepeatedVarianceSummary {
  ingredientId: number;
  ingredientName: string;
  outOfTolerancePeriodsCount: number;
  totalPeriodsChecked: number;
  lastVarianceValue: number;
  isRepeatedHighVariance: boolean;
  message: string;
}

export function analyzeRepeatedVariances(
  records: PeriodVarianceRecord[],
  minPeriodsForRepeat = 2
): Map<number, RepeatedVarianceSummary> {
  const map = new Map<number, { name: string; total: number; outCount: number; lastVal: number }>();

  for (const r of records) {
    let entry = map.get(r.ingredientId);
    if (!entry) {
      entry = { name: r.ingredientName, total: 0, outCount: 0, lastVal: 0 };
      map.set(r.ingredientId, entry);
    }
    entry.total += 1;
    if (r.isOut) {
      entry.outCount += 1;
    }
    entry.lastVal = r.varianceValue;
  }

  const results = new Map<number, RepeatedVarianceSummary>();
  map.forEach((data, id) => {
    const isRepeated = data.outCount >= minPeriodsForRepeat;
    results.set(id, {
      ingredientId: id,
      ingredientName: data.name,
      outOfTolerancePeriodsCount: data.outCount,
      totalPeriodsChecked: data.total,
      lastVarianceValue: data.lastVal,
      isRepeatedHighVariance: isRepeated,
      message: isRepeated
        ? `Berulang (${data.outCount} dari ${data.total} periode di luar toleransi)`
        : `Stabil (${data.outCount} dari ${data.total} periode)`,
    });
  });

  return results;
}
