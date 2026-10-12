import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ objects: new Map<string, { data: Buffer; contentType: string }>() }));
vi.mock("./db", () => ({
  putStoredObject: async (key: string, data: Buffer, contentType: string) => { h.objects.set(key, { data, contentType }); },
  getStoredObject: async (key: string) => h.objects.get(key) ?? null,
}));

describe("self-hosted owner login", () => {
  it("accepts only the exact configured password, in constant time", async () => {
    const { ownerPasswordMatches } = await import("./_core/ownerLogin");
    expect(ownerPasswordMatches("rahasia-123", "rahasia-123")).toBe(true);
    expect(ownerPasswordMatches("rahasia-124", "rahasia-123")).toBe(false);
    expect(ownerPasswordMatches("", "rahasia-123")).toBe(false);
    expect(ownerPasswordMatches(undefined, "rahasia-123")).toBe(false);
    expect(ownerPasswordMatches(42, "rahasia-123")).toBe(false);
    expect(ownerPasswordMatches("anything", "")).toBe(false);
  });
});

describe("database-backed storage (no Forge configured)", () => {
  beforeEach(() => { h.objects.clear(); });

  it("round-trips the exact bytes, including a non-UTF-8 payload", async () => {
    const { storagePut, storageGetBytes } = await import("./storage");
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xfe, 0x80]);
    const stored = await storagePut("exports/a.pdf", bytes, "application/pdf");
    const read = await storageGetBytes(stored.key);
    expect(Buffer.compare(read.data, bytes)).toBe(0);
    expect(read.contentType).toBe("application/pdf");
  });

  it("stores strings as UTF-8 and reports a missing key as STORAGE_NOT_FOUND", async () => {
    const { storagePut, storageGetBytes } = await import("./storage");
    const stored = await storagePut("exports/a.csv", "kopi,☕\n", "text/csv");
    expect((await storageGetBytes(stored.key)).data.toString("utf8")).toBe("kopi,☕\n");
    await expect(storageGetBytes("exports/missing.csv")).rejects.toMatchObject({ code: "STORAGE_NOT_FOUND" });
  });
});
