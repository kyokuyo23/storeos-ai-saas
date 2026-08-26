import { createHmac } from "crypto";
import QRCode from "qrcode";
import { ENV } from "./_core/env";
import {
  getGeneratedGovernanceAuditExportForOwner,
  verifyGovernanceAuditExportBytes,
  type GovernanceAuditGeneratedArtifact,
} from "./governanceAuditExportIntegrity";
import { GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES, isValidGovernanceAuditQrValidityMinutes } from "./governanceAuditQrExpiry";

const VERIFY_BASE_URL = "https://storeosai-53f6p9i9.manus.space";

export type GovernanceAuditVerificationQr = {
  version: 1;
  referenceId: string;
  exportId: string;
  receiptId: string;
  verificationStatus: "verified";
  issuedAt: Date;
  expiresAt: Date;
  payload: string;
  verificationUrl: string;
  imageDataUrl: string;
};

type CachedQrReference = {
  ownerOpenId: string;
  exportId: string;
  receiptId: string;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
};

const qrReferenceCache = new Map<string, CachedQrReference>();

function referenceId(ownerOpenId: string, exportId: string, receiptId: string) {
  const secret = ENV.cookieSecret || "storeos-local-qr-reference";
  return `qr_${createHmac("sha256", secret).update(`${ownerOpenId}:${exportId}:${receiptId}:v1`).digest("hex").slice(0, 32)}`;
}

function verificationUrl(referenceId: string, exportId: string, receiptId: string) {
  const url = new URL("/verify", VERIFY_BASE_URL);
  url.searchParams.set("ref", referenceId);
  url.searchParams.set("export", exportId);
  url.searchParams.set("receipt", receiptId);
  url.searchParams.set("status", "verified");
  return url.toString();
}

function payloadFor(referenceId: string, exportId: string, receiptId: string) {
  return JSON.stringify({ version: 1, referenceId, exportId, receiptId, verificationStatus: "verified" });
}

export async function createGovernanceAuditVerificationQr(
  ownerOpenId: string,
  artifact: GovernanceAuditGeneratedArtifact,
  receiptId: string,
  issuedAt = new Date(),
  validityMinutes = GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES,
): Promise<GovernanceAuditVerificationQr> {
  if (!isValidGovernanceAuditQrValidityMinutes(validityMinutes)) throw new Error("Masa berlaku QR tidak valid.");
  const ref = referenceId(ownerOpenId, artifact.exportId, receiptId);
  const expiresAt = new Date(issuedAt.getTime() + validityMinutes * 60 * 1000);
  const payload = payloadFor(ref, artifact.exportId, receiptId);
  const url = verificationUrl(ref, artifact.exportId, receiptId);
  qrReferenceCache.set(ref, { ownerOpenId, exportId: artifact.exportId, receiptId, issuedAt, expiresAt, revoked: false });
  return {
    version: 1,
    referenceId: ref,
    exportId: artifact.exportId,
    receiptId,
    verificationStatus: "verified",
    issuedAt,
    expiresAt,
    payload,
    verificationUrl: url,
    imageDataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 208 }),
  };
}

export type GovernanceAuditQrVerificationResult =
  | {
      status: "verified";
      exportId: string;
      receiptId: string;
      scope: string;
      format: GovernanceAuditGeneratedArtifact["format"];
      generatedAt: Date;
      generatedAtWib: string;
      verifiedAt: Date;
      verifiedAtWib: string;
      issuedAt: Date;
      issuedAtWib: string;
      expiresAt: Date;
      expiresAtWib: string;
      byteSize: number;
      sha256: string;
      verificationStatus: "verified";
    }
  | { status: "invalid_reference" | "revoked" | "not_found" | "artifact_missing" | "verification_failed"; message: string }
  | { status: "expired"; message: string; issuedAt: Date; issuedAtWib: string; expiresAt: Date; expiresAtWib: string };

function wibTime(value: Date) {
  return `${value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
}

export function revokeGovernanceAuditVerificationQrReference(referenceId: string) {
  const reference = qrReferenceCache.get(referenceId);
  if (reference) reference.revoked = true;
}

export function resolveGovernanceAuditVerificationQr(
  ownerOpenId: string,
  input: { referenceId: string; exportId: string; receiptId: string },
  now = new Date(),
): GovernanceAuditQrVerificationResult {
  const reference = qrReferenceCache.get(input.referenceId);
  if (!reference) return { status: "not_found", message: "Referensi QR verifikasi tidak ditemukan pada konteks server ini." };
  if (reference.ownerOpenId !== ownerOpenId || reference.exportId !== input.exportId || reference.receiptId !== input.receiptId) {
    return { status: "invalid_reference", message: "Referensi QR tidak cocok dengan ekspor atau bukti verifikasi yang diminta." };
  }
  if (reference.revoked) return { status: "revoked", message: "Referensi QR verifikasi telah dicabut." };
  if (reference.expiresAt.getTime() <= now.getTime()) return {
    status: "expired",
    message: "Referensi QR verifikasi telah kedaluwarsa. Buat dan verifikasi ulang ekspor audit.",
    issuedAt: reference.issuedAt,
    issuedAtWib: wibTime(reference.issuedAt),
    expiresAt: reference.expiresAt,
    expiresAtWib: wibTime(reference.expiresAt),
  };

  const artifact = getGeneratedGovernanceAuditExportForOwner(ownerOpenId, reference.exportId);
  if (!artifact) return { status: "artifact_missing", message: "Byte ekspor audit tidak tersedia. Referensi QR tidak dapat membuktikan integritas." };
  let verification;
  try {
    verification = verifyGovernanceAuditExportBytes(artifact.exportId, artifact.bytesBase64);
  } catch {
    return { status: "artifact_missing", message: "Byte ekspor audit tidak dapat dibaca. Referensi QR tidak dapat diverifikasi." };
  }
  if (!verification.verified || verification.actualSha256 !== artifact.sha256 || verification.byteSize !== artifact.byteSize) {
    return { status: "verification_failed", message: "Checksum ekspor audit tidak cocok. Referensi QR tidak dapat diterima sebagai bukti integritas." };
  }
  return {
    status: "verified",
    exportId: artifact.exportId,
    receiptId: reference.receiptId,
    scope: artifact.scope,
    format: artifact.format,
    generatedAt: artifact.generatedAt,
    generatedAtWib: wibTime(artifact.generatedAt),
    verifiedAt: now,
    verifiedAtWib: wibTime(now),
    issuedAt: reference.issuedAt,
    issuedAtWib: wibTime(reference.issuedAt),
    expiresAt: reference.expiresAt,
    expiresAtWib: wibTime(reference.expiresAt),
    byteSize: artifact.byteSize,
    sha256: artifact.sha256,
    verificationStatus: "verified",
  };
}
