/**
 * Store branding: name + logo shown in the app shell, login page, browser tab and printed reports.
 * Logo bytes live in storedObjects (PNG/JPEG/WebP only — no SVG, which could carry script).
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { businessSettings, storedObjects } from "../drizzle/schema";
import { getSettings, requireDb } from "./db";

export const MAX_LOGO_BYTES = 512_000;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const LOGO_ERROR = "Logo harus PNG, JPG, atau WebP, maksimal 500 KB.";

export const logoInput = z.object({
  contentType: z.enum(LOGO_TYPES, { message: LOGO_ERROR }),
  dataBase64: z.string().min(1, LOGO_ERROR).max(Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 4, LOGO_ERROR),
});

/** Decode base64 and confirm the bytes really are the declared image type (magic numbers). */
export function decodeLogo(input: z.infer<typeof logoInput>) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64)) throw new TRPCError({ code: "BAD_REQUEST", message: LOGO_ERROR });
  const data = Buffer.from(input.dataBase64, "base64");
  const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isWebp = data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP";
  const ok = (input.contentType === "image/png" && isPng) || (input.contentType === "image/jpeg" && isJpeg) || (input.contentType === "image/webp" && isWebp);
  if (!ok || data.byteLength === 0 || data.byteLength > MAX_LOGO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: LOGO_ERROR });
  return { contentType: input.contentType, data };
}

/** Public branding (no secrets): used by the login page before sign-in. */
export async function getBranding() {
  const settings = await getSettings();
  return {
    businessName: settings.businessName,
    storeLocation: settings.storeLocation,
    logoUrl: settings.logoStorageKey && settings.logoUpdatedAt ? `/api/branding/logo?v=${new Date(settings.logoUpdatedAt).getTime()}` : null,
  };
}

export async function setStoreLogo(input: z.infer<typeof logoInput>) {
  const logo = decodeLogo(input);
  const settings = await getSettings();
  const db = await requireDb();
  const storageKey = `branding/logo-${nanoid(16)}`;
  await db.transaction(async (tx) => {
    await tx.insert(storedObjects).values({ storageKey, contentType: logo.contentType, byteSize: logo.data.byteLength, data: logo.data });
    await tx.update(businessSettings).set({ logoStorageKey: storageKey, logoUpdatedAt: new Date() }).where(eq(businessSettings.id, settings.id));
    // The previous logo is replaced, not history: drop its bytes.
    if (settings.logoStorageKey) await tx.delete(storedObjects).where(eq(storedObjects.storageKey, settings.logoStorageKey));
  });
  return getBranding();
}

export async function removeStoreLogo() {
  const settings = await getSettings();
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.update(businessSettings).set({ logoStorageKey: null, logoUpdatedAt: new Date() }).where(eq(businessSettings.id, settings.id));
    if (settings.logoStorageKey) await tx.delete(storedObjects).where(eq(storedObjects.storageKey, settings.logoStorageKey));
  });
  return getBranding();
}

export async function getStoreLogo() {
  const settings = await getSettings();
  if (!settings.logoStorageKey) return null;
  const db = await requireDb();
  return (await db.select({ contentType: storedObjects.contentType, data: storedObjects.data }).from(storedObjects).where(eq(storedObjects.storageKey, settings.logoStorageKey)).limit(1))[0] ?? null;
}
