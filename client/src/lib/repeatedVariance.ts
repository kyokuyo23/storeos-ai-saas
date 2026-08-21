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
  isRepeatedHighVariance: boolean;
  message: string;
  contextText: string;
}

/**
 * Analyze repeated high variance across recent comparable Jakarta/WIB periods.
 * Rules:
 * 1. Considers up to the 3 most recent comparable periods.
 * 2. If fewer than 3 comparable periods exist, does not classify as recurring (isRepeatedHighVariance = false).
 * 3. Flags when outOfTolerancePeriodsCount >= 2 (i.e. 2 of 3 or 3 of 3). 0/3 or 1/3 are not flagged.
 */
export function analyzeRepeatedVariances(
  records: PeriodVarianceRecord[]
): Map<number, RepeatedVarianceSummary> {
  // Group records by periodKey to identify distinct periods, sorted chronologically descending (most recent first)
  const periodMap = new Map<string, PeriodVarianceRecord[]>();
  for (const r of records) {
    let list = periodMap.get(r.periodKey);
    if (!list) {
      list = [];
      periodMap.set(r.periodKey, list);
    }
    list.push(r);
  }

  // Sort period keys descending (assuming periodKey or label allows chronological order, or sort by record entries)
  const sortedPeriodKeys = Array.from(periodMap.keys()).sort().reverse();
  const recentPeriodKeys = sortedPeriodKeys.slice(0, 3);
  const totalPeriodsAvailable = recentPeriodKeys.length;

  // Gather unique ingredient IDs across all records
  const ingredientMap = new Map<number, { name: string; recordsByPeriod: Map<string, boolean> }>();
  for (const r of records) {
    let ing = ingredientMap.get(r.ingredientId);
    if (!ing) {
      ing = { name: r.ingredientName, recordsByPeriod: new Map() };
      ingredientMap.set(r.ingredientId, ing);
    }
    ing.recordsByPeriod.set(r.periodKey, r.isOut);
  }

  const results = new Map<number, RepeatedVarianceSummary>();

  ingredientMap.forEach((ingData, ingId) => {
    // If fewer than 3 comparable periods exist in total across the dataset, rule 5 applies: do not falsely classify
    if (totalPeriodsAvailable < 3) {
      results.set(ingId, {
        ingredientId: ingId,
        ingredientName: ingData.name,
        outOfTolerancePeriodsCount: 0,
        totalPeriodsChecked: totalPeriodsAvailable,
        isRepeatedHighVariance: false,
        message: 'Varians stabil (kurang dari 3 periode pembanding)',
        contextText: '',
      });
      return;
    }

    // Check the 3 most recent periods
    let outCount = 0;
    for (const pk of recentPeriodKeys) {
      const isOut = ingData.recordsByPeriod.get(pk) ?? false;
      if (isOut) {
        outCount += 1;
      }
    }

    // Rule 3: Flag when 2 of 3 or 3 of 3 are out of tolerance. Rule 4: 0/3 or 1/3 must NOT be flagged.
    const isRepeated = outCount >= 2;
    let contextText = '';
    if (isRepeated) {
      contextText = `${outCount} dari 3 periode terakhir`;
    }

    results.set(ingId, {
      ingredientId: ingId,
      ingredientName: ingData.name,
      outOfTolerancePeriodsCount: outCount,
      totalPeriodsChecked: 3,
      isRepeatedHighVariance: isRepeated,
      message: isRepeated ? `Varians tinggi berulang (${contextText})` : `Stabil (${outCount}/3 periode)`,
      contextText,
    });
  });

  return results;
}
