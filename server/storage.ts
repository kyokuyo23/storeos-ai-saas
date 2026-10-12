// Preconfigured storage helpers for Manus WebDev templates
// Uploads via Forge Server presigned URL to S3 (PUT direct).
// Downloads return /manus-storage/{key} paths served via 307 redirect.

import { ENV } from "./_core/env";
import * as db from "./db";

/** Manus Forge when configured; otherwise bytes live in the application database (e.g. Vercel + TiDB). */
const useForge = () => Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);

function notFound() {
  const error = new Error("Stored artifact was not found");
  (error as Error & { code?: string }).code = "STORAGE_NOT_FOUND";
  return error;
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  if (!useForge()) {
    const key = appendHashSuffix(normalizeKey(relKey));
    await db.putStoredObject(key, Buffer.from(typeof data === "string" ? Buffer.from(data, "utf8") : data), contentType);
    return { key, url: `db-storage://${key}` };
  }
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  // 1. Get presigned PUT URL from Forge
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  // 2. PUT file directly to S3
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}

/**
 * Reads object bytes only on the server so callers can validate checksums before
 * an application serves a file. This never exposes a Forge credential or signed
 * S3 URL to a browser.
 */
export async function storageGetBytes(relKey: string): Promise<{ key: string; data: Buffer; contentType: string | null }> {
  const key = normalizeKey(relKey);
  if (!useForge()) {
    const row = await db.getStoredObject(key);
    if (!row) throw notFound();
    return { key, data: Buffer.from(row.data), contentType: row.contentType };
  }
  const signedUrl = await storageGetSignedUrl(key);
  const response = await fetch(signedUrl);
  if (response.status === 404) {
    const error = new Error("Stored artifact was not found");
    (error as Error & { code?: string }).code = "STORAGE_NOT_FOUND";
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Storage download failed (${response.status})`);
  }
  return {
    key,
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}
