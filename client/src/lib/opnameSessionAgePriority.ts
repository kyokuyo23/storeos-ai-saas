export type OpenOpnameAgePriority = {
  tone: "normal" | "warning" | "critical" | "empty";
  label: string;
  description: string;
};

export type OpnameHistorySessionPriority = {
  tone: "normal" | "warning" | "critical" | "resolved" | "not_required";
  label: string;
  description: string;
  ageDays: number | null;
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

export function getJakartaCalendarDayAge(occurredAt: Date, now = new Date()) {
  const toCalendarDay = (value: Date) => {
    const [year, month, day] = new Date(value.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(0, Math.round((toCalendarDay(now) - toCalendarDay(occurredAt)) / 86_400_000));
}

export function getOpnameHistorySessionPriority(input: { ageDays: number; requiresFollowUp: boolean; isResolved: boolean; thresholds?: Partial<typeof defaultOpenOpnameAgeThresholds> }): OpnameHistorySessionPriority {
  if (!input.requiresFollowUp) return { tone: "not_required", label: "Sesuai", description: "Tidak ada selisih stok yang memerlukan tindak lanjut.", ageDays: null };
  if (input.isResolved) return { tone: "resolved", label: "Tuntas", description: "Selisih stok pada sesi ini telah selesai ditindaklanjuti.", ageDays: input.ageDays };
  const priority = getOpenOpnameAgePriority(input.ageDays, input.thresholds);
  return { tone: priority.tone === "empty" ? "normal" : priority.tone, label: priority.label, description: priority.description, ageDays: input.ageDays };
}
