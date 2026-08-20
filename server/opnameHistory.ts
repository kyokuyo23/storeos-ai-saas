export type StockOpnameHistoryMovement = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantityDelta: number;
  balanceAfter: number;
  note: string | null;
  occurredAt: Date;
};

export type StockOpnameSession = {
  reference: string;
  occurredAt: Date;
  note: string | null;
  totalItems: number;
  differenceItems: number;
  totalAbsoluteDifference: number;
  followUpStatus: "not_required" | "needs_follow_up" | "in_progress" | "resolved";
  items: Array<Pick<StockOpnameHistoryMovement, "id" | "ingredientId" | "ingredientName" | "unit" | "quantityDelta" | "balanceAfter">>;
};

function parseSessionNote(note: string | null) {
  const reference = note?.match(/\bOPN-\d+-[A-Z0-9]+\b/)?.[0];
  if (!reference) return null;
  const trailingNote = note!.slice(note!.indexOf(reference) + reference.length).replace(/^[\s·]+/, "").trim();
  return { reference, note: trailingNote || null };
}

export function summarizeStockOpnameSessions(rows: StockOpnameHistoryMovement[], referenceFilter?: string | null): StockOpnameSession[] {
  const normalizedFilter = referenceFilter?.trim().toLocaleLowerCase("id-ID") || "";
  const grouped = new Map<string, StockOpnameSession>();
  for (const row of rows) {
    const parsed = parseSessionNote(row.note);
    if (!parsed || (normalizedFilter && !parsed.reference.toLocaleLowerCase("id-ID").includes(normalizedFilter))) continue;
    const session = grouped.get(parsed.reference) ?? { reference: parsed.reference, occurredAt: row.occurredAt, note: parsed.note, totalItems: 0, differenceItems: 0, totalAbsoluteDifference: 0, followUpStatus: "not_required" as const, items: [] };
    session.occurredAt = session.occurredAt > row.occurredAt ? session.occurredAt : row.occurredAt;
    session.totalItems += 1;
    if (row.quantityDelta !== 0) session.differenceItems += 1;
    session.totalAbsoluteDifference = Number((session.totalAbsoluteDifference + Math.abs(row.quantityDelta)).toFixed(3));
    session.items.push({ id: row.id, ingredientId: row.ingredientId, ingredientName: row.ingredientName, unit: row.unit, quantityDelta: row.quantityDelta, balanceAfter: row.balanceAfter });
    grouped.set(parsed.reference, session);
  }
  return Array.from(grouped.values()).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).map((session) => ({ ...session, followUpStatus: session.differenceItems > 0 ? "needs_follow_up" : "not_required", items: session.items.sort((left, right) => left.ingredientName.localeCompare(right.ingredientName, "id-ID")) }));
}

export function applyStockOpnameFollowUpStatuses(sessions: StockOpnameSession[], followUps: Array<{ auditReference: string; status: "needs_follow_up" | "in_progress" | "resolved" }>): StockOpnameSession[] {
  const byReference = new Map(followUps.map((followUp) => [followUp.auditReference, followUp.status]));
  return sessions.map((session) => ({ ...session, followUpStatus: session.differenceItems > 0 ? (byReference.get(session.reference) ?? "needs_follow_up") : "not_required" }));
}
