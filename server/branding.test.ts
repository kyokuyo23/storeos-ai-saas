import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.OWNER_OPEN_ID = "owner-1"; });
vi.mock("./db", () => ({ getSettings: vi.fn(), requireDb: vi.fn() }));
vi.mock("./monthlyReportArtifacts", () => ({ canAccessMonthlyReportArtifacts: () => false }));

import { appRouter } from "./routers";
import { decodeLogo } from "./branding";

const caller = (user: Record<string, unknown> | null) => appRouter.createCaller({ user: user as any, req: {} as any, res: { clearCookie: vi.fn() } as any });
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString("base64");

describe("store logo", () => {
  it("accepts only real PNG/JPEG/WebP bytes up to 500 KB (no SVG)", () => {
    expect(decodeLogo({ contentType: "image/png", dataBase64: png }).data.byteLength).toBe(12);
    expect(() => decodeLogo({ contentType: "image/jpeg", dataBase64: png })).toThrow(/Logo/);
    expect(() => decodeLogo({ contentType: "image/png", dataBase64: Buffer.from("<svg onload=alert(1)>").toString("base64") })).toThrow(/Logo/);
  });

  it("only the owner or admin sistem can change the logo", async () => {
    const kasir = { id: 2, openId: "member_k", role: "user", username: "kasir1", isActive: true, accessLevel: "member" };
    await expect(caller(kasir).settings.setLogo({ contentType: "image/png", dataBase64: png })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(kasir).settings.removeLogo()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(null).settings.setLogo({ contentType: "image/png", dataBase64: png })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
