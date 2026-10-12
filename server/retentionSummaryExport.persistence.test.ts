import { afterEach, describe, expect, it, vi } from "vitest";

type Row = { id: number; ownerOpenId: string; exportId: string; createdAt: Date; [key: string]: unknown };
const persistedRows: Row[] = [];
let lastWhere: { owner?: string; exportId?: string } = {};

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  // Capture column/value pairs from eq() so the fake DB can apply the owner-scoped predicate.
  return { ...actual, eq: (column: { name?: string }, value: string) => ({ __eq: [column.name, value] }), and: (...parts: Array<{ __eq: [string, string] }>) => ({ __and: parts }) };
});
vi.mock("postgres", () => ({ default: () => ({}) }));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: (predicate: { __and: Array<{ __eq: [string, string] }> }) => ({
          limit: async () => {
            const wanted = Object.fromEntries(predicate.__and.map((part) => part.__eq));
            lastWhere = { owner: wanted.ownerOpenId, exportId: wanted.exportId };
            return persistedRows.filter((row) => row.ownerOpenId === wanted.ownerOpenId && row.exportId === wanted.exportId);
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (input: Omit<Row, "id" | "createdAt">) => {
        if (persistedRows.some((row) => row.ownerOpenId === input.ownerOpenId && row.exportId === input.exportId)) {
          throw Object.assign(new Error("Duplicate entry"), { code: "23505" });
        }
        persistedRows.push({ ...input, id: persistedRows.length + 1, createdAt: new Date("2026-10-07T00:00:00.000Z") });
      },
    }),
  }),
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const exportId = `storeos-retention-summary-csv-${"a".repeat(64)}`;
const input = () => ({
  ownerOpenId: "owner-restart",
  exportId,
  format: "csv" as const,
  storageKey: "retention-summary-exports/abc/x_deadbeef.csv",
  sha256: "a".repeat(64),
  byteSize: 321,
  evaluatedAt: new Date("2026-10-07T17:30:45.000Z"),
  scopeLabel: "owner-scope:abcdef012345",
  datePreset: "last_3_months",
  rangeStartDate: "2026-07-01",
  rangeEndDate: "2026-09-30",
  snapshotJson: "{}",
});

afterEach(() => {
  persistedRows.splice(0, persistedRows.length);
  process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe("Phase 2.23 durable retention summary export index", () => {
  it("persists metadata only, survives a fresh module context, and treats retries idempotently", async () => {
    process.env.DATABASE_URL = "mysql://isolated-test/index";
    const first = await import("./db");
    await expect(first.indexRetentionSummaryExport(input())).resolves.toMatchObject({ outcome: "indexed" });
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0]).toMatchObject({ exportId, sha256: "a".repeat(64), byteSize: 321 });
    expect(persistedRows[0]).not.toHaveProperty("bytesBase64");

    vi.resetModules();
    const restarted = await import("./db");
    await expect(restarted.getRetentionSummaryExportIndex("owner-restart", exportId)).resolves.toMatchObject({ exportId, storageKey: "retention-summary-exports/abc/x_deadbeef.csv" });
    await expect(restarted.indexRetentionSummaryExport(input())).resolves.toMatchObject({ outcome: "already_indexed" });
    expect(persistedRows).toHaveLength(1);
  });

  it("scopes lookups to the owner: another owner cannot read the row", async () => {
    process.env.DATABASE_URL = "mysql://isolated-test/index";
    const context = await import("./db");
    await context.indexRetentionSummaryExport(input());
    await expect(context.getRetentionSummaryExportIndex("someone-else", exportId)).resolves.toBeNull();
    expect(lastWhere).toEqual({ owner: "someone-else", exportId });
  });
});
