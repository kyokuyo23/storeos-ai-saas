import { describe, expect, it } from "vitest";
import { applyStockOpnameFollowUpStatuses, summarizeStockOpnameSessions, type StockOpnameHistoryMovement } from "./opnameHistory";

const movement = (id: number, ingredientName: string, quantityDelta: number, reference: string | null, occurredAt = "2026-08-20T03:00:00.000Z"): StockOpnameHistoryMovement => ({ id, ingredientId: id, ingredientName, unit: "gram", quantityDelta, balanceAfter: 10 + quantityDelta, note: reference ? `Stock opname fisik · ${reference} · Shift pagi` : "Opname manual lama", occurredAt: new Date(occurredAt) });

describe("summarizeStockOpnameSessions", () => {
  it("mengelompokkan catatan ledger batch berdasarkan satu referensi audit", () => {
    const sessions = summarizeStockOpnameSessions([movement(1, "Biji Kopi", -2, "OPN-100-AB12C"), movement(2, "Susu", 0, "OPN-100-AB12C"), movement(3, "Gula", 3, "OPN-101-ZX90Q", "2026-08-20T04:00:00.000Z")]);
    expect(sessions).toHaveLength(2);
    expect(sessions[1]).toMatchObject({ reference: "OPN-100-AB12C", note: "Shift pagi", totalItems: 2, differenceItems: 1, totalAbsoluteDifference: 2 });
    expect(sessions[1].followUpStatus).toBe("needs_follow_up");
    expect(sessions[1].items.map((item) => item.ingredientName)).toEqual(["Biji Kopi", "Susu"]);
  });

  it("menyaring berdasarkan nomor referensi audit dan mengabaikan opname manual tanpa referensi sesi", () => {
    const sessions = summarizeStockOpnameSessions([movement(1, "Biji Kopi", -2, "OPN-100-AB12C"), movement(2, "Susu", 1, "OPN-200-ZX90Q"), movement(3, "Gula", 5, null)], "zx90");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ reference: "OPN-200-ZX90Q", totalItems: 1, differenceItems: 1, totalAbsoluteDifference: 1 });
  });

  it("menampilkan status tindak lanjut tersimpan hanya untuk sesi yang memiliki selisih", () => {
    const sessions = summarizeStockOpnameSessions([movement(1, "Biji Kopi", -2, "OPN-100-AB12C"), movement(2, "Susu", 0, "OPN-200-ZX90Q")]);
    const withStatuses = applyStockOpnameFollowUpStatuses(sessions, [{ auditReference: "OPN-100-AB12C", status: "in_progress" }]);
    expect(withStatuses.find((session) => session.reference === "OPN-100-AB12C")?.followUpStatus).toBe("in_progress");
    expect(withStatuses.find((session) => session.reference === "OPN-200-ZX90Q")?.followUpStatus).toBe("not_required");
  });

  it("menyertakan catatan tindak lanjut tersimpan hanya pada sesi yang berselisih", () => {
    const sessions = summarizeStockOpnameSessions([movement(1, "Biji Kopi", -2, "OPN-100-AB12C"), movement(2, "Susu", 0, "OPN-200-ZX90Q")]);
    const withNotes = applyStockOpnameFollowUpStatuses(sessions, [{ auditReference: "OPN-100-AB12C", status: "resolved", followUpNote: "Selisih sudah diverifikasi pada catatan penerimaan." }]);
    expect(withNotes.find((session) => session.reference === "OPN-100-AB12C")).toMatchObject({ followUpStatus: "resolved", followUpNote: "Selisih sudah diverifikasi pada catatan penerimaan." });
    expect(withNotes.find((session) => session.reference === "OPN-200-ZX90Q")?.followUpNote).toBeNull();
  });
});
