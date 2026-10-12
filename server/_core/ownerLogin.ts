import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const digest = (value: string) => createHash("sha256").update(value).digest();
const FAILURE_DELAY_MS = 600;
export const MIN_OWNER_PASSWORD_LENGTH = 12;

/** Why owner login is unavailable, or null when it can be used. */
export function ownerLoginConfigProblem(env: { ownerPassword: string; ownerOpenId: string }) {
  if (!env.ownerPassword || !env.ownerOpenId) return "Login pemilik belum dikonfigurasi (OWNER_PASSWORD / OWNER_OPEN_ID).";
  if (env.ownerPassword.length < MIN_OWNER_PASSWORD_LENGTH) return `OWNER_PASSWORD terlalu pendek (minimal ${MIN_OWNER_PASSWORD_LENGTH} karakter).`;
  if (env.ownerOpenId.startsWith("cron_")) return "OWNER_OPEN_ID tidak boleh diawali 'cron_'.";
  return null;
}
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
    const problem = ownerLoginConfigProblem(ENV);
    res.json({ enabled: !problem, ...(problem ? { problem } : {}) });
  });

  app.post("/api/auth/owner-login", async (req: Request, res: Response) => {
    const problem = ownerLoginConfigProblem(ENV);
    if (problem) {
      res.status(503).json({ error: problem });
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
