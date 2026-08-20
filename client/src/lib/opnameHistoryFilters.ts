export const opnameHistoryStatusFilters = ["all", "open", "needs_follow_up", "in_progress", "resolved"] as const;
export type OpnameHistoryStatusFilter = typeof opnameHistoryStatusFilters[number];
export const opnameHistoryPriorityFilters = ["all", "normal", "warning", "critical", "resolved", "not_required"] as const;
export type OpnameHistoryPriorityFilter = typeof opnameHistoryPriorityFilters[number];

export function getOpnameHistoryStatusFilter(search: string): OpnameHistoryStatusFilter {
  const value = new URLSearchParams(search).get("status");
  return opnameHistoryStatusFilters.includes(value as OpnameHistoryStatusFilter) ? value as OpnameHistoryStatusFilter : "all";
}

export function getOpnameHistoryPriorityFilter(search: string): OpnameHistoryPriorityFilter {
  const value = new URLSearchParams(search).get("priority");
  return opnameHistoryPriorityFilters.includes(value as OpnameHistoryPriorityFilter) ? value as OpnameHistoryPriorityFilter : "all";
}

export function getOpnameHistorySessionReference(search: string) {
  const value = new URLSearchParams(search).get("session")?.trim();
  return value || null;
}

export function getOpenOpnameSessionHistoryPath(reference: string) {
  return `/inventory/opname-history?status=open&session=${encodeURIComponent(reference)}`;
}

export function filterOpnameSessionsByStatus<T extends { followUpStatus: string }>(sessions: T[], filter: OpnameHistoryStatusFilter): T[] {
  if (filter === "all") return sessions;
  if (filter === "open") return sessions.filter((session) => session.followUpStatus === "needs_follow_up" || session.followUpStatus === "in_progress");
  return sessions.filter((session) => session.followUpStatus === filter);
}

export function filterOpnameSessionsByPriority<T>(sessions: T[], filter: OpnameHistoryPriorityFilter, getPriority: (session: T) => string): T[] {
  return filter === "all" ? sessions : sessions.filter((session) => getPriority(session) === filter);
}
