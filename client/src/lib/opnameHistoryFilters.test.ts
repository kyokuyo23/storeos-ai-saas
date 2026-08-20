import { describe, expect, it } from "vitest";
import { filterOpnameSessionsByStatus, getOpnameHistoryStatusFilter } from "./opnameHistoryFilters";

describe("opname history status filters", () => {
  it("reads only supported status filters from the history URL", () => {
    expect(getOpnameHistoryStatusFilter("?status=open")).toBe("open");
    expect(getOpnameHistoryStatusFilter("?status=resolved")).toBe("resolved");
    expect(getOpnameHistoryStatusFilter("?status=unknown")).toBe("all");
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
});
