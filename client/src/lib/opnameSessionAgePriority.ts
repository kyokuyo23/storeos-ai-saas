export type OpenOpnameAgePriority = {
  tone: "normal" | "warning" | "critical" | "empty";
  label: string;
  description: string;
};

export function getOpenOpnameAgePriority(ageDays: number | null | undefined): OpenOpnameAgePriority {
  if (ageDays === null || ageDays === undefined) return { tone: "empty", label: "Tidak ada sesi terbuka", description: "Belum ada sesi opname yang memerlukan tindak lanjut." };
  if (ageDays >= 7) return { tone: "critical", label: "Mendesak", description: "Usia 7 hari atau lebih memerlukan tindak lanjut segera." };
  if (ageDays >= 3) return { tone: "warning", label: "Perlu perhatian", description: "Usia 3–6 hari perlu dipantau dan ditindaklanjuti." };
  return { tone: "normal", label: "Terkendali", description: "Usia 0–2 hari masih dalam pemantauan awal." };
}
