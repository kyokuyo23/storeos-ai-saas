import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => (process.env.OWNER_OPEN_ID = "owner-1", {
  listProducts: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({ id: 1 })),
  updateSettings: vi.fn(async () => undefined),
  listMemberAccounts: vi.fn(async () => []),
  getMemberByUsername: vi.fn(async (_username: string) => undefined as unknown),
  createMemberAccount: vi.fn(async (input: { name: string; username: string; passwordHash: string }) => ({ id: 7, name: input.name, username: input.username })),
  setMemberPassword: vi.fn(async () => true),
  setMemberActive: vi.fn(async () => false),
  setMemberAccessLevel: vi.fn(async () => true),
}));

vi.mock("./db", () => h);
vi.mock("./monthlyReportArtifacts", () => ({
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null) => user?.openId === "owner-1" && user.role === "admin",
}));

import { appRouter } from "./routers";
import { hashPassword, isOwnerUsername, memberCreateInput, publicUser, verifyPassword } from "./userAccounts";

const caller = (user: Record<string, unknown> | null) => appRouter.createCaller({ user: user as any, req: {} as any, res: { clearCookie: vi.fn() } as any });
const owner = { id: 1, openId: "owner-1", role: "admin", name: "Pemilik", lastSignedIn: new Date() };
const member = { id: 2, openId: "member_abc", role: "user", name: "Sari", username: "sari", passwordHash: "scrypt$secret", isActive: true, lastSignedIn: new Date() };
const sysadmin = { ...member, id: 5, openId: "member_sys", username: "sysadmin", accessLevel: "sysadmin" };
const settings = { businessName: "Kopi", storeLocation: "Bekasi", currency: "IDR", timezone: "Asia/Jakarta", opnameWarningAgeDays: 3, opnameCriticalAgeDays: 7, inventoryVarianceAbsoluteTolerance: 0, inventoryVariancePercentageTolerance: 0 };

describe("member passwords", () => {
  it("hashes with a random salt and verifies only the exact password", async () => {
    const first = await hashPassword("rahasia-kasir-1");
    const second = await hashPassword("rahasia-kasir-1");
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword("rahasia-kasir-1", first)).toBe(true);
    expect(await verifyPassword("rahasia-kasir-2", first)).toBe(false);
    expect(await verifyPassword("rahasia-kasir-1", "plain-text")).toBe(false);
    expect(await verifyPassword("rahasia-kasir-1", null)).toBe(false);
  });

  it("validates usernames, reserves the owner names and never exposes the hash", () => {
    expect(memberCreateInput.parse({ name: "Sari", username: " Sari.K ", password: "12345678" }).username).toBe("sari.k");
    for (const username of ["pemilik", "owner", "admin", "ab", "spasi tengah"]) expect(memberCreateInput.safeParse({ name: "X", username, password: "12345678" }).success).toBe(false);
    expect(memberCreateInput.safeParse({ name: "X", username: "kasir1", password: "pendek" }).success).toBe(false);
    expect(isOwnerUsername(" Pemilik ")).toBe(true);
    const shown = publicUser(member as any, "owner-1");
    expect(shown).not.toHaveProperty("passwordHash");
    expect(shown.isOwner).toBe(false);
    expect(publicUser(owner as any, "owner-1").isOwner).toBe(true);
  });
});

describe("access by role", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires login for store data and returns a safe auth.me", async () => {
    await expect(caller(null).product.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await caller(null).auth.me()).toBeNull();
    const me = await caller(member).auth.me();
    expect(me).toMatchObject({ username: "sari", isOwner: false });
    expect(me).not.toHaveProperty("passwordHash");
  });

  it("lets members run operations but keeps settings changes and user management owner-only", async () => {
    await expect(caller(member).product.list()).resolves.toEqual([]);
    await expect(caller(member).settings.get()).resolves.toEqual({ id: 1 });
    await expect(caller(member).settings.update(settings)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(member).users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(member).users.create({ name: "Budi", username: "budi", password: "12345678" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.updateSettings).not.toHaveBeenCalled();
    expect(h.createMemberAccount).not.toHaveBeenCalled();
    await caller(owner).settings.update(settings);
    expect(h.updateSettings).toHaveBeenCalledTimes(1);
  });

  it("owner creates members with a hashed password, rejects duplicates and unknown ids", async () => {
    const created = await caller(owner).users.create({ name: "Budi", username: "Budi", password: "kasir-budi-01" });
    expect(created).toMatchObject({ username: "budi" });
    const stored = h.createMemberAccount.mock.calls[0][0];
    expect(stored.passwordHash).not.toContain("kasir-budi-01");
    expect(await verifyPassword("kasir-budi-01", stored.passwordHash)).toBe(true);
    h.getMemberByUsername.mockResolvedValueOnce({ id: 3 });
    await expect(caller(owner).users.create({ name: "Budi 2", username: "budi", password: "kasir-budi-01" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller(owner).users.resetPassword({ id: 3, password: "baru-12345" })).resolves.toEqual({ success: true });
    await expect(caller(owner).users.setActive({ id: 99, isActive: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sysadmin manages settings and users, but not report archives, and cannot lock itself out", async () => {
    await caller(sysadmin).settings.update(settings);
    expect(h.updateSettings).toHaveBeenCalledTimes(1);
    await expect(caller(sysadmin).users.list()).resolves.toEqual([]);
    await caller(sysadmin).users.create({ name: "Kasir 1", username: "kasir1", password: "kasir-satu-01", accessLevel: "member" });
    expect(h.createMemberAccount.mock.calls[0][0]).toMatchObject({ username: "kasir1", accessLevel: "member" });
    await expect(caller(sysadmin).users.setActive({ id: 5, isActive: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(sysadmin).users.setAccessLevel({ id: 5, accessLevel: "member" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(sysadmin).users.setAccessLevel({ id: 2, accessLevel: "sysadmin" })).resolves.toEqual({ success: true });
    await expect(caller(sysadmin).reports.archiveMonthlyArtifact({ year: 2026, month: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await caller(sysadmin).auth.me()).toMatchObject({ accessLevel: "sysadmin", canManage: true, isOwner: false });
    expect(await caller({ ...sysadmin, isActive: false }).users.list().catch((error) => error.code)).toBe("FORBIDDEN");
    expect(await caller(member).auth.me()).toMatchObject({ accessLevel: "member", canManage: false });
  });
});
