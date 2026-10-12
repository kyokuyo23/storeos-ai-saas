import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const digest = (value: string) => createHash("sha256").update(value).digest();
const FAILURE_DELAY_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Constant-time password comparison (both sides hashed to equal length first). */
export function ownerPasswordMatches(candidate: unknown, expected: string) {
  if (typeof candidate !== "string" || !expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

/**
 * Password login for self-hosted deployments (e.g. Vercel) that have no Manus OAuth.
 * Enabled only when OWNER_PASSWORD and OWNER_OPEN_ID are both set; the session is the
 * same signed cookie the OAuth flow issues, for the owner (admin) user.
 */
export function registerOwnerLoginRoutes(app: Express) {
  app.get("/api/auth/owner-login", (_req: Request, res: Response) => {
    res.json({ enabled: Boolean(ENV.ownerPassword && ENV.ownerOpenId) });
  });

  app.post("/api/auth/owner-login", async (req: Request, res: Response) => {
    if (!ENV.ownerPassword || !ENV.ownerOpenId) {
      res.status(503).json({ error: "Login pemilik belum dikonfigurasi (OWNER_PASSWORD / OWNER_OPEN_ID)." });
      return;
    }
    if (!ownerPasswordMatches(req.body?.password, ENV.ownerPassword)) {
      await sleep(FAILURE_DELAY_MS);
      res.status(401).json({ error: "Kata sandi salah." });
      return;
    }
    try {
      await db.upsertUser({ openId: ENV.ownerOpenId, name: "Pemilik", loginMethod: "password", role: "admin", lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(ENV.ownerOpenId, { name: "Pemilik", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), sameSite: "lax", maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[OwnerLogin] failed", error);
      res.status(500).json({ error: "Login gagal. Periksa koneksi database." });
    }
  });
}
