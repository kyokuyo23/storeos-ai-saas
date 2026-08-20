export type OpenOpnameAgePriority = {
  tone: "normal" | "warning" | "critical" | "empty";
  label: string;
  description: string;
};

export const defaultOpenOpnameAgeThresholds = { warningAgeDays: 3, criticalAgeDays: 7 };

export function getOpenOpnameAgePriority(ageDays: number | null | undefined, thresholds: Partial<typeof defaultOpenOpnameAgeThresholds> = {}): OpenOpnameAgePriority {
  if (ageDays === null || ageDays === undefined) return { tone: "empty", label: "Tidak ada sesi terbuka", description: "Belum ada sesi opname yang memerlukan tindak lanjut." };
  const warningAgeDays = thresholds.warningAgeDays ?? defaultOpenOpnameAgeThresholds.warningAgeDays;
  const criticalAgeDays = thresholds.criticalAgeDays ?? defaultOpenOpnameAgeThresholds.criticalAgeDays;
  if (ageDays >= criticalAgeDays) return { tone: "critical", label: "Mendesak", description: `Usia ${criticalAgeDays} hari atau lebih memerlukan tindak lanjut segera.` };
  if (ageDays >= warningAgeDays) return { tone: "warning", label: "Perlu perhatian", description: `Usia ${warningAgeDays}–${criticalAgeDays - 1} hari perlu dipantau dan ditindaklanjuti.` };
  return { tone: "normal", label: "Terkendali", description: `Usia 0–${warningAgeDays - 1} hari masih dalam pemantauan awal.` };
}
