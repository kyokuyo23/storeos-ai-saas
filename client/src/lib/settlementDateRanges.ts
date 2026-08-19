export type SettlementDateRange = { startDate: string; endDate: string };

export function jakartaDateValue(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function shiftCalendarDate(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getSettlementDatePresets(now = new Date()) {
  const today = jakartaDateValue(now);
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return {
    today: { startDate: today, endDate: today },
    week: { startDate: shiftCalendarDate(today, -daysSinceMonday), endDate: today },
    month: { startDate: `${today.slice(0, 8)}01`, endDate: today },
  } satisfies Record<"today" | "week" | "month", SettlementDateRange>;
}
