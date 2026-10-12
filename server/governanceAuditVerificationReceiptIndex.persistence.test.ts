import { afterEach, describe, expect, it, vi } from "vitest";

type StoredReceipt = {
  id: number;
  ownerOpenId: string;
  receiptSha256: string;
  verificationAt: Date;
  createdAt: Date;
  [key: string]: unknown;
};

const persistedRows: StoredReceipt[] = [];

vi.mock("postgres", () => ({ default: () => ({}) }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const requested = selectQueue.shift();
            return requested === "missing" ? [] : persistedRows.filter((row) => row.ownerOpenId === "owner-restart" && row.receiptSha256 === "a".repeat(64));
          },
          orderBy: async () => [...persistedRows].sort((left, right) => right.verificationAt.getTime() - left.verificationAt.getTime() || right.id - left.id),
        }),
      }),
    }),
    insert: () => ({
      values: async (input: Omit<StoredReceipt, "id" | "createdAt">) => {
        if (persistedRows.some((row) => row.ownerOpenId === input.ownerOpenId && row.receiptSha256 === input.receiptSha256)) {
          throw Object.assign(new Error("Duplicate entry"), { code: "23505" });
        }
        persistedRows.push({ ...input, id: persistedRows.length + 1, createdAt: new Date("2026-08-27T00:00:00.000Z") });
      },
    }),
  }),
}));

let selectQueue: ("missing" | "existing")[] = [];
const originalDatabaseUrl = process.env.DATABASE_URL;

const fixture = () => ({
  ownerOpenId: "owner-restart",
  receiptId: "receipt-restart",
  receiptFormat: "csv" as const,
  receiptSha256: "a".repeat(64),
  receiptByteSize: 321,
  verificationStatus: "verified" as const,
  verificationAt: new Date("2026-08-27T01:00:00.000Z"),
  issuedByOpenId: "owner-restart",
  exportId: "export-restart",
  exportFormat: "csv" as const,
  exportGeneratedAt: new Date("2026-08-27T00:55:00.000Z"),
  exportScope: "governance_audit_qr_policy_receipt",
  exportByteSize: 987,
  exportSha256: "b".repeat(64),
  exportRecordCount: 1,
  qrReferenceId: `qr_${"c".repeat(32)}`,
  qrIssuedAt: new Date("2026-08-27T01:00:00.000Z"),
  qrExpiresAt: new Date("2026-08-27T01:30:00.000Z"),
  policyEventId: "qrph_restart",
  policyPreviousValidityMinutes: 30,
  policyValidityMinutes: 45,
  policyDifferenceMinutes: 15,
  policyChange: "increase" as const,
});

afterEach(() => {
  persistedRows.splice(0, persistedRows.length);
  selectQueue = [];
  process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe("Phase 2.17 durable receipt metadata index", () => {
  it("retains one immutable metadata-only receipt across a fresh database module context and treats retries idempotently", async () => {
    process.env.DATABASE_URL = "mysql://isolated-test/index";
    selectQueue = ["missing", "existing"];
    const firstContext = await import("./db");
    const input = fixture();

    await expect(firstContext.indexGovernanceAuditVerificationReceipt(input)).resolves.toMatchObject({ outcome: "indexed" });
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0]).toMatchObject({
      receiptId: input.receiptId,
      receiptSha256: input.receiptSha256,
      qrReferenceId: input.qrReferenceId,
      policyEventId: input.policyEventId,
    });
    expect(persistedRows[0]).not.toHaveProperty("bytesBase64");

    vi.resetModules();
    const restartedContext = await import("./db");
    const reloaded = await restartedContext.listGovernanceAuditVerificationReceiptIndex("owner-restart");
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({ receiptId: input.receiptId, receiptSha256: input.receiptSha256, policyValidityMinutes: 45 });

    const restartedReceiptContext = await import("./governanceAuditVerificationReceipts");
    const durableReceipts = await restartedReceiptContext.listIssuedGovernanceAuditVerificationReceipts("owner-restart");
    expect(durableReceipts).toMatchObject([{
      receiptId: input.receiptId,
      qr: { referenceId: input.qrReferenceId, issuedAt: input.qrIssuedAt, expiresAt: input.qrExpiresAt },
      policy: { policyEventId: input.policyEventId, previousValidityMinutes: 30, validityMinutes: 45, differenceMinutes: 15, change: "increase" },
      indexPersistence: "durable",
    }]);

    selectQueue = ["missing", "existing"];
    const laterReceipt = {
      ...fixture(),
      receiptId: "receipt-restart-later",
      receiptSha256: "d".repeat(64),
      verificationAt: new Date("2026-08-27T01:05:00.000Z"),
      qrReferenceId: `qr_${"e".repeat(32)}`,
      qrIssuedAt: new Date("2026-08-27T01:05:00.000Z"),
      qrExpiresAt: new Date("2026-08-27T01:35:00.000Z"),
      policyEventId: null,
      policyPreviousValidityMinutes: null,
      policyValidityMinutes: 45,
      policyDifferenceMinutes: 0,
      policyChange: "unchanged" as const,
    };
    await expect(restartedContext.indexGovernanceAuditVerificationReceipt(laterReceipt)).resolves.toMatchObject({ outcome: "indexed" });
    const multipleReceipts = await restartedReceiptContext.listIssuedGovernanceAuditVerificationReceipts("owner-restart");
    expect(multipleReceipts.map((receipt) => receipt.receiptId)).toEqual([laterReceipt.receiptId, input.receiptId]);
    expect(multipleReceipts.every((receipt) => receipt.indexPersistence === "durable")).toBe(true);
    expect(persistedRows.every((receipt) => !("bytesBase64" in receipt))).toBe(true);

    vi.resetModules();
    vi.doMock("./db", () => ({
      listGovernanceAuditQrExpiryPolicyHistory: async () => [{
        eventId: "qrph_restart", ownerOpenId: "owner-restart", previousValidityMinutes: 30, newValidityMinutes: 45,
        resultingValidityMinutes: 45, changedAt: new Date("2026-08-27T00:45:00.000Z"), actorOpenId: "owner-restart",
      }],
      getGovernanceAuditQrRevocation: async () => null,
    }));
    vi.doMock("./governanceAuditVerificationReceipts", () => ({
      listIssuedGovernanceAuditVerificationReceipts: async () => durableReceipts,
    }));
    const { getGovernanceAuditQrPolicyReceiptAuditExport } = await import("./governanceAuditQrPolicyReceiptAuditExport");
    const combinedAudit = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-restart", {}, new Date("2026-08-27T01:10:00.000Z"));
    expect(combinedAudit.records).toMatchObject([{
      receiptId: input.receiptId,
      qrReferenceId: input.qrReferenceId,
      qrStatus: "active",
      policyEventId: "qrph_restart",
      policyPreviousValidityMinutes: 30,
      policyValidityMinutes: 45,
      policyDifferenceMinutes: 15,
      policyDirection: "increase",
      policyActorOpenId: "owner-restart",
      policyCorrelation: "matched_policy_event",
    }]);

    selectQueue = ["existing"];
    vi.doUnmock("./db");
    const retryContext = await import("./db");
    await expect(retryContext.indexGovernanceAuditVerificationReceipt(input)).resolves.toMatchObject({ outcome: "already_indexed" });
    expect(persistedRows).toHaveLength(2);
  });
});
