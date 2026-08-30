export const reportReviewPresets = ["current_month", "previous_month", "last_3_months", "current_quarter", "previous_quarter", "current_year"] as const;

export type ReportReviewPreset = typeof reportReviewPresets[number];

export type ReportReviewUrlState = {
  preset: ReportReviewPreset | null;
  year: number;
  month: number;
  artifactList: ReportArtifactListUrlState;
};

export type JakartaYearMonth = { year: number; month: number };
export const reportArtifactListFormats = ["csv", "html", "pdf"] as const;
export type ReportArtifactListFormat = typeof reportArtifactListFormats[number];
export const reportArtifactRetentionStatuses = ["normal", "approaching", "eligible"] as const;
export type ReportArtifactRetentionStatus = typeof reportArtifactRetentionStatuses[number];
export type ReportArtifactListUrlState = {
  active: boolean;
  format: ReportArtifactListFormat | null;
  integrity: "healthy" | null;
  retentionStatus: ReportArtifactRetentionStatus | null;
};

export const reportReviewPresetOptions: Array<{ value: ReportReviewPreset; label: string; periodCount: number }> = [
  { value: "current_month", label: "Bulan berjalan", periodCount: 1 },
  { value: "previous_month", label: "Bulan sebelumnya", periodCount: 1 },
  { value: "last_3_months", label: "3 bulan terakhir", periodCount: 3 },
  { value: "current_quarter", label: "Kuartal berjalan", periodCount: 3 },
  { value: "previous_quarter", label: "Kuartal sebelumnya", periodCount: 3 },
  { value: "current_year", label: "Tahun berjalan", periodCount: 12 },
];

function isPermittedYear(value: number, fallbackYear: number) {
  return Number.isInteger(value) && value >= fallbackYear - 3 && value <= fallbackYear + 3;
}

function addCalendarMonths(value: JakartaYearMonth, offset: number): JakartaYearMonth {
  const date = new Date(Date.UTC(value.year, value.month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Parses only supported Reports state and ignores malformed or out-of-window URL values. */
export function parseReportReviewUrlState(search: string, fallback: JakartaYearMonth): ReportReviewUrlState {
  const params = new URLSearchParams(search);
  const candidatePreset = params.get("reportPreset");
  const preset = reportReviewPresets.includes(candidatePreset as ReportReviewPreset) ? candidatePreset as ReportReviewPreset : null;
  const candidateYear = Number(params.get("reportYear"));
  const candidateMonth = Number(params.get("reportMonth"));
  const active = params.get("artifactView") === "active";
  const candidateFormat = params.get("artifactFormat");
  return {
    preset,
    year: isPermittedYear(candidateYear, fallback.year) ? candidateYear : fallback.year,
    month: Number.isInteger(candidateMonth) && candidateMonth >= 1 && candidateMonth <= 12 ? candidateMonth : fallback.month,
    artifactList: {
      active,
      format: active && reportArtifactListFormats.includes(candidateFormat as ReportArtifactListFormat) ? candidateFormat as ReportArtifactListFormat : null,
      integrity: active && params.get("artifactIntegrity") === "healthy" ? "healthy" : null,
      retentionStatus: active && reportArtifactRetentionStatuses.includes(params.get("artifactRetention") as ReportArtifactRetentionStatus) ? params.get("artifactRetention") as ReportArtifactRetentionStatus : null,
    },
  };
}

/** Keeps URL state shareable while omitting the unchanged default Reports view. */
export function getReportReviewPath(state: ReportReviewUrlState, defaults: JakartaYearMonth) {
  if (!state.preset && state.year === defaults.year && state.month === defaults.month && !state.artifactList.active) return "/reports";
  const params = new URLSearchParams({ reportYear: String(state.year), reportMonth: String(state.month) });
  if (state.preset) params.set("reportPreset", state.preset);
  if (state.artifactList.active) {
    params.set("artifactView", "active");
    if (state.artifactList.format) params.set("artifactFormat", state.artifactList.format);
    if (state.artifactList.integrity) params.set("artifactIntegrity", state.artifactList.integrity);
    if (state.artifactList.retentionStatus) params.set("artifactRetention", state.artifactList.retentionStatus);
  }
  return `/reports?${params.toString()}`;
}

/** Returns only the focused monthly report identity; server audit responses remain authoritative for range boundaries. */
export function getFocusedMonthForReportReviewPreset(preset: ReportReviewPreset, now: JakartaYearMonth): JakartaYearMonth {
  switch (preset) {
    case "previous_month": return addCalendarMonths(now, -1);
    case "previous_quarter": {
      const currentQuarterStartMonth = Math.floor((now.month - 1) / 3) * 3 + 1;
      return addCalendarMonths({ year: now.year, month: currentQuarterStartMonth }, -1);
    }
    case "current_quarter": {
      const currentQuarterStartMonth = Math.floor((now.month - 1) / 3) * 3 + 1;
      return addCalendarMonths({ year: now.year, month: currentQuarterStartMonth }, 2);
    }
    default: return now;
  }
}
