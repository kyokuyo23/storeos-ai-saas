export const opnameHistoryStatusFilters = ["all", "open", "needs_follow_up", "in_progress", "resolved"] as const;
export type OpnameHistoryStatusFilter = typeof opnameHistoryStatusFilters[number];

export function getOpnameHistoryStatusFilter(search: string): OpnameHistoryStatusFilter {
  const value = new URLSearchParams(search).get("status");
  return opnameHistoryStatusFilters.includes(value as OpnameHistoryStatusFilter) ? value as OpnameHistoryStatusFilter : "all";
}

export function getOpnameHistorySessionReference(search: string) {
  const value = new URLSearchParams(search).get("session")?.trim();
  return value || null;
}

export function filterOpnameSessionsByStatus<T extends { followUpStatus: string }>(sessions: T[], filter: OpnameHistoryStatusFilter): T[] {
  if (filter === "all") return sessions;
  if (filter === "open") return sessions.filter((session) => session.followUpStatus === "needs_follow_up" || session.followUpStatus === "in_progress");
  return sessions.filter((session) => session.followUpStatus === filter);
}
