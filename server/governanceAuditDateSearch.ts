export const GOVERNANCE_AUDIT_DATE_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "current_month",
  "previous_month",
  "last_3_months",
  "last_12_months",
] as const;

export type GovernanceAuditDatePreset = typeof GOVERNANCE_AUDIT_DATE_PRESETS[number];

export type GovernanceAuditDateSearchFilters = {
  startDate?: string;
  endDate?: string;
  datePreset?: GovernanceAuditDatePreset;
  searchTerm?: string;
};

export type GovernanceAuditResolvedDateRange = {
  preset: GovernanceAuditDatePreset | null;
  label: string | null;
  startDate: string | null;
  endDate: string | null;
  startWib: string | null;
  endWib: string | null;
  boundary: "start_inclusive_end_exclusive_wib";
};

const PRESET_LABEL: Record<GovernanceAuditDatePreset, string> = {
  today: "Hari ini",
  last_7_days: "7 hari terakhir",
  last_30_days: "30 hari terakhir",
  current_month: "Bulan berjalan",
  previous_month: "Bulan sebelumnya",
  last_3_months: "3 bulan terakhir",
  last_12_months: "12 bulan terakhir",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateString(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function datePartsInJakarta(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function shiftCalendarDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return dateString(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

function monthStart(value: string, monthsOffset = 0) {
  const [year, month] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + monthsOffset, 1));
  return dateString(result.getUTCFullYear(), result.getUTCMonth() + 1, 1);
}

function monthEnd(value: string, monthsOffset = 0) {
  return shiftCalendarDate(monthStart(value, monthsOffset + 1), -1);
}

export function isValidGovernanceAuditWibDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

/** Converts a Jakarta calendar-date start to UTC; Jakarta has no daylight-saving adjustment. */
export function governanceAuditWibStart(value: string) {
  if (!isValidGovernanceAuditWibDate(value)) throw new Error("Tanggal filter harus berformat YYYY-MM-DD yang valid di Jakarta/WIB.");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7));
}

export function nextGovernanceAuditWibDay(value: string) {
  if (!isValidGovernanceAuditWibDate(value)) throw new Error("Tanggal filter harus berformat YYYY-MM-DD yang valid di Jakarta/WIB.");
  return shiftCalendarDate(value, 1);
}

function formattedWibBoundary(value: string) {
  return `${value} 00:00:00 WIB`;
}

export function validateGovernanceAuditDateSearchFilters(filters: GovernanceAuditDateSearchFilters) {
  if (filters.startDate && !isValidGovernanceAuditWibDate(filters.startDate)) throw new Error("Tanggal mulai filter QR harus valid di Jakarta/WIB.");
  if (filters.endDate && !isValidGovernanceAuditWibDate(filters.endDate)) throw new Error("Tanggal akhir filter QR harus valid di Jakarta/WIB.");
  if (filters.startDate && filters.endDate && governanceAuditWibStart(filters.startDate).getTime() > governanceAuditWibStart(filters.endDate).getTime()) throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir.");
  if (filters.datePreset && !GOVERNANCE_AUDIT_DATE_PRESETS.includes(filters.datePreset)) throw new Error("Preset rentang waktu audit tidak valid.");
  if (filters.searchTerm !== undefined && (!filters.searchTerm.trim() || filters.searchTerm.trim().length > 160)) throw new Error("Kata pencarian audit tidak valid.");
}

/** Resolves all preset boundaries on the server from the supplied UTC reference time. */
export function resolveGovernanceAuditDateRange(filters: GovernanceAuditDateSearchFilters, referenceNow = new Date()): GovernanceAuditResolvedDateRange {
  validateGovernanceAuditDateSearchFilters(filters);
  if (!filters.datePreset) {
    const endExclusive = filters.endDate ? nextGovernanceAuditWibDay(filters.endDate) : null;
    return {
      preset: null,
      label: null,
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      startWib: filters.startDate ? formattedWibBoundary(filters.startDate) : null,
      endWib: endExclusive ? formattedWibBoundary(endExclusive) : null,
      boundary: "start_inclusive_end_exclusive_wib",
    };
  }
  const current = datePartsInJakarta(referenceNow);
  const today = dateString(current.year, current.month, current.day);
  const range = (() => {
    switch (filters.datePreset) {
      case "today": return { startDate: today, endDate: today };
      case "last_7_days": return { startDate: shiftCalendarDate(today, -6), endDate: today };
      case "last_30_days": return { startDate: shiftCalendarDate(today, -29), endDate: today };
      case "current_month": return { startDate: monthStart(today), endDate: monthEnd(today) };
      case "previous_month": return { startDate: monthStart(today, -1), endDate: monthEnd(today, -1) };
      case "last_3_months": return { startDate: monthStart(today, -2), endDate: monthEnd(today) };
      case "last_12_months": return { startDate: monthStart(today, -11), endDate: monthEnd(today) };
    }
  })();
  const endExclusive = nextGovernanceAuditWibDay(range.endDate);
  return {
    preset: filters.datePreset,
    label: PRESET_LABEL[filters.datePreset],
    startDate: range.startDate,
    endDate: range.endDate,
    startWib: formattedWibBoundary(range.startDate),
    endWib: formattedWibBoundary(endExclusive),
    boundary: "start_inclusive_end_exclusive_wib",
  };
}

export function normaliseGovernanceAuditSearchTerm(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

/** Performs literal matching only; no regex or untrusted query interpretation is used. */
export function matchesGovernanceAuditSearch(searchTerm: string | undefined, searchableValues: Array<string | null | undefined>) {
  const normalized = normaliseGovernanceAuditSearchTerm(searchTerm);
  return !normalized || searchableValues.some((value) => value?.toLocaleLowerCase("en-US").includes(normalized));
}
