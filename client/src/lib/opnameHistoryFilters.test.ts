import { describe, expect, it } from "vitest";
import { filterOpnameSessionsByPriority, filterOpnameSessionsByStatus, getOpnameHistoryPriorityFilter, getOpnameHistorySessionReference, getOpnameHistoryStatusFilter } from "./opnameHistoryFilters";

describe("opname history status filters", () => {
  it("reads only supported status filters from the history URL", () => {
    expect(getOpnameHistoryStatusFilter("?status=open")).toBe("open");
    expect(getOpnameHistoryStatusFilter("?status=resolved")).toBe("resolved");
    expect(getOpnameHistoryStatusFilter("?status=unknown")).toBe("all");
  });

  it("reads a trimmed audit-reference session target from the history URL", () => {
    expect(getOpnameHistorySessionReference("?status=open&session=OPN-1724-ABCDE")).toBe("OPN-1724-ABCDE");
    expect(getOpnameHistorySessionReference("?session=%20OPN-1724-ABCDE%20")).toBe("OPN-1724-ABCDE");
    expect(getOpnameHistorySessionReference("?status=open")).toBeNull();
  });

  it("reads only supported priority filters from the history URL", () => {
    expect(getOpnameHistoryPriorityFilter("?priority=warning")).toBe("warning");
    expect(getOpnameHistoryPriorityFilter("?priority=critical")).toBe("critical");
    expect(getOpnameHistoryPriorityFilter("?priority=expired")).toBe("all");
  });

  it("groups both unresolved follow-up states under the open filter", () => {
    const sessions = [
      { reference: "OPN-1", followUpStatus: "needs_follow_up" },
      { reference: "OPN-2", followUpStatus: "in_progress" },
      { reference: "OPN-3", followUpStatus: "resolved" },
      { reference: "OPN-4", followUpStatus: "not_required" },
    ];
    expect(filterOpnameSessionsByStatus(sessions, "open").map((session) => session.reference)).toEqual(["OPN-1", "OPN-2"]);
  });

  it("filters sessions with the priority determined from the saved threshold rules", () => {
    const sessions = [{ reference: "OPN-1", priority: "normal" }, { reference: "OPN-2", priority: "warning" }, { reference: "OPN-3", priority: "critical" }];
    expect(filterOpnameSessionsByPriority(sessions, "critical", (session) => session.priority).map((session) => session.reference)).toEqual(["OPN-3"]);
  });
});
