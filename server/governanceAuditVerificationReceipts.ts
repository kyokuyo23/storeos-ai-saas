import { createHash } from "crypto";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import {
  deriveGovernanceAuditQrReceiptPolicyContext,
  type GovernanceAuditQrReceiptPolicyContext,
} from "./governanceAuditQrExpiry";
import {
  getGeneratedGovernanceAuditExportForOwner,
  verifyGovernanceAuditExportBytes,
  type GovernanceAuditExportFormat,
} from "./governanceAuditExportIntegrity";
import { createGovernanceAuditVerificationQr, type GovernanceAuditVerificationQr } from "./governanceAuditVerificationQr";
import { indexGovernanceAuditVerificationReceipt, listGovernanceAuditVerificationReceiptIndex } from "./db";

export type GovernanceAuditReceiptFormat = "csv" | "pdf";

export type GovernanceAuditVerificationReceipt = {
  kind: "storeos_governance_audit_verification_receipt";
  version: 1;
  receiptId: string;
  receiptFormat: GovernanceAuditReceiptFormat;
  filename: string;
  contentType: "text/csv;charset=utf-8" | "application/pdf";
  receiptByteSize: number;
  receiptSha256: string;
  verificationAt: Date;
  verificationAtWib: string;
  applicationVersion: "StoreOS Governance Audit v2.14";
  export: {
    exportId: string;
    format: GovernanceAuditExportFormat;
    generatedAt: Date;
    generatedAtWib: string;
    timezone: "Asia/Jakarta";
    scope: string;
    byteSize: number;
    sha256: string;
    recordCount: number;
  };
  verification: {
    status: "verified";
    verified: true;
    expectedSha256: string;
    actualSha256: string;
    byteSize: number;
  };
  qr: GovernanceAuditVerificationQr;
  policy: GovernanceAuditQrReceiptPolicyContext & {
    issuedAt: Date;
    expiresAt: Date;
  };
  bytesBase64: string;
};

export type GovernanceAuditVerificationReceiptResult =
  | { status: "issued"; receipt: GovernanceAuditVerificationReceipt }
  | { status: "export_not_available"; message: string }
  | { status: "verification_failed"; message: string; expectedSha256?: string; actualSha256?: string }
  | { status: "receipt_index_failed"; message: string };

type CachedGovernanceAuditVerificationReceipt = GovernanceAuditVerificationReceipt & {
  ownerOpenId: string;
};

/** The metadata-only receipt shape used by the combined audit; it has no receipt bytes or QR image payload. */
export type GovernanceAuditVerificationReceiptAuditRecord = Pick<GovernanceAuditVerificationReceipt,
  "receiptId" | "receiptFormat" | "receiptByteSize" | "receiptSha256" | "verificationAt" | "export" | "verification" | "policy"
> & {
  qr: Pick<GovernanceAuditVerificationQr, "referenceId" | "exportId" | "receiptId" | "verificationStatus" | "issuedAt" | "expiresAt">;
  indexPersistence: "durable" | "process_local";
};

export class GovernanceAuditVerificationReceiptIndexIntegrityError extends Error {
  constructor() {
    super("Metadata indeks receipt governance audit tidak valid; receipt tidak dapat diperlakukan sebagai record audit valid.");
    this.name = "GovernanceAuditVerificationReceiptIndexIntegrityError";
  }
}

/**
 * A process-local, owner-scoped audit index of receipts that have already been
 * issued by this server instance. It does not alter receipt bytes or recover
 * policy values from current configuration. It mirrors the established
 * process-local governance export and QR reference contexts.
 */
const issuedReceiptCache = new Map<string, CachedGovernanceAuditVerificationReceipt>();

function issuedReceiptCacheKey(ownerOpenId: string, receipt: GovernanceAuditVerificationReceipt) {
  return `${ownerOpenId}:${receipt.receiptId}:${receipt.receiptFormat}:${receipt.receiptSha256}`;
}

function toAuditRecord(receipt: GovernanceAuditVerificationReceipt, indexPersistence: GovernanceAuditVerificationReceiptAuditRecord["indexPersistence"]): GovernanceAuditVerificationReceiptAuditRecord {
  return {
    receiptId: receipt.receiptId,
    receiptFormat: receipt.receiptFormat,
    receiptByteSize: receipt.receiptByteSize,
    receiptSha256: receipt.receiptSha256,
    verificationAt: receipt.verificationAt,
    export: receipt.export,
    verification: receipt.verification,
    qr: {
      referenceId: receipt.qr.referenceId,
      exportId: receipt.qr.exportId,
      receiptId: receipt.qr.receiptId,
      verificationStatus: receipt.qr.verificationStatus,
      issuedAt: receipt.qr.issuedAt,
      expiresAt: receipt.qr.expiresAt,
    },
    policy: receipt.policy,
    indexPersistence,
  };
}

function isValidStoredDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isValidDurableReceiptIndexRecord(receipt: Awaited<ReturnType<typeof listGovernanceAuditVerificationReceiptIndex>>[number]) {
  return receipt.ownerOpenId.length > 0
    && receipt.receiptId.length > 0
    && (receipt.receiptFormat === "csv" || receipt.receiptFormat === "pdf")
    && /^[a-f0-9]{64}$/.test(receipt.receiptSha256)
    && Number.isInteger(receipt.receiptByteSize) && receipt.receiptByteSize > 0
    && receipt.verificationStatus === "verified"
    && isValidStoredDate(receipt.verificationAt)
    && receipt.issuedByOpenId.length > 0
    && receipt.exportId.length > 0
    && (receipt.exportFormat === "csv" || receipt.exportFormat === "pdf")
    && isValidStoredDate(receipt.exportGeneratedAt)
    && receipt.exportScope.length > 0
    && Number.isInteger(receipt.exportByteSize) && receipt.exportByteSize > 0
    && /^[a-f0-9]{64}$/.test(receipt.exportSha256)
    && Number.isInteger(receipt.exportRecordCount) && receipt.exportRecordCount >= 0
    && /^qr_[a-f0-9]{32}$/.test(receipt.qrReferenceId)
    && isValidStoredDate(receipt.qrIssuedAt)
    && isValidStoredDate(receipt.qrExpiresAt)
    && receipt.qrExpiresAt.getTime() >= receipt.qrIssuedAt.getTime()
    && Number.isInteger(receipt.policyValidityMinutes)
    && Number.isInteger(receipt.policyDifferenceMinutes)
    && ["initial", "increase", "decrease", "unchanged"].includes(receipt.policyChange);
}

export async function listIssuedGovernanceAuditVerificationReceipts(ownerOpenId: string): Promise<GovernanceAuditVerificationReceiptAuditRecord[]> {
  const indexed = await listGovernanceAuditVerificationReceiptIndex(ownerOpenId);
  return indexed.map((receipt) => {
    if (!isValidDurableReceiptIndexRecord(receipt)) throw new GovernanceAuditVerificationReceiptIndexIntegrityError();
    return {
    receiptId: receipt.receiptId,
    receiptFormat: receipt.receiptFormat as GovernanceAuditReceiptFormat,
    receiptByteSize: receipt.receiptByteSize,
    receiptSha256: receipt.receiptSha256,
    verificationAt: receipt.verificationAt,
    export: {
      exportId: receipt.exportId,
      format: receipt.exportFormat as GovernanceAuditExportFormat,
      generatedAt: receipt.exportGeneratedAt,
      generatedAtWib: wibTime(receipt.exportGeneratedAt),
      timezone: "Asia/Jakarta",
      scope: receipt.exportScope,
      byteSize: receipt.exportByteSize,
      sha256: receipt.exportSha256,
      recordCount: receipt.exportRecordCount,
    },
    verification: {
      status: "verified",
      verified: true,
      expectedSha256: receipt.exportSha256,
      actualSha256: receipt.exportSha256,
      byteSize: receipt.exportByteSize,
    },
    qr: {
      referenceId: receipt.qrReferenceId,
      exportId: receipt.exportId,
      receiptId: receipt.receiptId,
      verificationStatus: "verified",
      issuedAt: receipt.qrIssuedAt,
      expiresAt: receipt.qrExpiresAt,
    },
    policy: {
      validityMinutes: receipt.policyValidityMinutes,
      policyEventId: receipt.policyEventId,
      previousValidityMinutes: receipt.policyPreviousValidityMinutes,
      change: receipt.policyChange as GovernanceAuditQrReceiptPolicyContext["change"],
      differenceMinutes: receipt.policyDifferenceMinutes,
      issuedAt: receipt.qrIssuedAt,
      expiresAt: receipt.qrExpiresAt,
    },
      indexPersistence: "durable",
    };
  });
}

export function clearIssuedGovernanceAuditVerificationReceiptsForTests() {
  issuedReceiptCache.clear();
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function wibTime(value: Date) {
  return `${value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
}

function escapeCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function receiptRows(receipt: Omit<GovernanceAuditVerificationReceipt, "bytesBase64" | "receiptByteSize" | "receiptSha256">) {
  const policyChangeLabel = receipt.policy.change === "initial"
    ? "Initial policy — no previous policy."
    : receipt.policy.change === "increase"
      ? "Meningkat"
      : receipt.policy.change === "decrease"
        ? "Menurun"
        : "Tidak berubah";
  return [
    ["StoreOS Governance Audit Verification Receipt", "v1"],
    ["Application version", receipt.applicationVersion],
    ["Receipt ID", receipt.receiptId],
    ["Receipt format", receipt.receiptFormat],
    ["Verification result", "verified"],
    ["Verification timestamp (Asia/Jakarta)", receipt.verificationAtWib],
    ["Export ID", receipt.export.exportId],
    ["Export format", receipt.export.format],
    ["Export generatedAt (Asia/Jakarta)", receipt.export.generatedAtWib],
    ["Timezone", receipt.export.timezone],
    ["Selected report/filter scope", receipt.export.scope],
    ["Lifecycle records", receipt.export.recordCount],
    ["Export byte size", receipt.export.byteSize],
    ["Export SHA-256", receipt.export.sha256],
    ["Verified SHA-256", receipt.verification.actualSha256],
    ["QR verification reference", receipt.qr.referenceId],
    ["QR verification status", receipt.qr.verificationStatus],
    ["QR issuedAt (Asia/Jakarta)", wibTime(receipt.qr.issuedAt)],
    ["QR expiresAt (Asia/Jakarta)", wibTime(receipt.qr.expiresAt)],
    ["QR verification payload", receipt.qr.payload],
    ["Masa berlaku QR (menit)", receipt.policy.validityMinutes],
    ["Kebijakan sebelumnya (menit)", receipt.policy.previousValidityMinutes ?? "Initial policy — no previous policy."],
    ["Kebijakan saat diterbitkan (menit)", receipt.policy.validityMinutes],
    ["Perubahan", policyChangeLabel],
    ["Perbedaan (menit)", receipt.policy.differenceMinutes],
    ["Referensi event kebijakan", receipt.policy.policyEventId ?? "Initial policy — no previous policy."],
    ["Diterbitkan kebijakan QR (Asia/Jakarta)", wibTime(receipt.policy.issuedAt)],
    ["Berakhir kebijakan QR (Asia/Jakarta)", wibTime(receipt.policy.expiresAt)],
  ];
}

function buildReceiptCsvBytes(receipt: Omit<GovernanceAuditVerificationReceipt, "bytesBase64" | "receiptByteSize" | "receiptSha256">) {
  return Buffer.from(`\uFEFF${receiptRows(receipt).map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildReceiptPdfBytes(receipt: Omit<GovernanceAuditVerificationReceipt, "bytesBase64" | "receiptByteSize" | "receiptSha256">) {
  const lines = receiptRows(receipt).map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>StoreOS Verification Receipt</title><style>body{font-family:Arial,sans-serif;color:#17251f;font-size:12px;padding:28px}h1{font-size:19px;margin:0 0 8px}p{margin:0 0 16px;color:#436052}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd8d0;padding:8px;vertical-align:top;text-align:left;word-break:break-word}th{background:#edf6f0;width:38%}.qr{margin:20px 0;display:flex;gap:14px;align-items:center}.qr img{width:132px;height:132px}.qr code{word-break:break-all;color:#436052}</style></head><body><h1>StoreOS Governance Audit Verification Receipt</h1><p>Read-only receipt for an exact verified governance audit export.</p><div class="qr"><img src="${receipt.qr.imageDataUrl}" alt="QR verification reference" /><div><strong>QR verification reference</strong><br /><code>${escapeHtml(receipt.qr.referenceId)}</code><br /><small>QR contains only the safe verification reference, export ID, receipt ID, and verified status.</small></div></div><table>${lines}</table></body></html>`;
  return printableMonthlyHtmlToPdf(html, {
    title: "StoreOS Governance Audit Verification Receipt",
    subject: "Verified exact-byte governance audit export receipt",
    creationDate: receipt.verificationAt,
  });
}

export async function issueGovernanceAuditVerificationReceipt(
  ownerOpenId: string,
  input: {
    exportId: string;
    bytesBase64: string;
    receiptFormat: GovernanceAuditReceiptFormat;
    qrValidityMinutes?: number;
    qrPolicyContext?: GovernanceAuditQrReceiptPolicyContext;
  },
  verificationAt = new Date(),
): Promise<GovernanceAuditVerificationReceiptResult> {
  const artifact = getGeneratedGovernanceAuditExportForOwner(ownerOpenId, input.exportId);
  if (!artifact) {
    return { status: "export_not_available", message: "Ekspor audit tidak tersedia pada konteks server ini. Buat dan verifikasi ulang ekspor sebelum mengunduh bukti." };
  }

  let verification;
  try {
    verification = verifyGovernanceAuditExportBytes(input.exportId, input.bytesBase64);
  } catch {
    return { status: "export_not_available", message: "Byte ekspor audit tidak tersedia atau tidak valid. Bukti verifikasi tidak diterbitkan." };
  }

  if (!verification.verified || input.bytesBase64 !== artifact.bytesBase64 || verification.byteSize !== artifact.byteSize || verification.actualSha256 !== artifact.sha256) {
    return {
      status: "verification_failed",
      message: "Checksum byte ekspor tidak cocok. Bukti verifikasi berhasil tidak dapat diterbitkan.",
      expectedSha256: artifact.sha256,
      actualSha256: verification.actualSha256,
    };
  }

  const receiptId = `storeos-governance-audit-receipt-${artifact.exportId}`;
  const qr = await createGovernanceAuditVerificationQr(ownerOpenId, artifact, receiptId, verificationAt, input.qrValidityMinutes);
  const qrValidityMinutes = Math.round((qr.expiresAt.getTime() - qr.issuedAt.getTime()) / 60_000);
  const policyContext = input.qrPolicyContext?.validityMinutes === qrValidityMinutes
    ? input.qrPolicyContext
    : deriveGovernanceAuditQrReceiptPolicyContext(qrValidityMinutes);
  const baseReceipt = {
    kind: "storeos_governance_audit_verification_receipt" as const,
    version: 1 as const,
    receiptId,
    receiptFormat: input.receiptFormat,
    filename: `storeos-governance-audit-verification-receipt-${artifact.exportId}.${input.receiptFormat}`,
    contentType: (input.receiptFormat === "csv" ? "text/csv;charset=utf-8" : "application/pdf") as GovernanceAuditVerificationReceipt["contentType"],
    verificationAt,
    verificationAtWib: wibTime(verificationAt),
    applicationVersion: "StoreOS Governance Audit v2.14" as const,
    export: {
      exportId: artifact.exportId,
      format: artifact.format,
      generatedAt: artifact.generatedAt,
      generatedAtWib: wibTime(artifact.generatedAt),
      timezone: artifact.timezone,
      scope: artifact.scope,
      byteSize: artifact.byteSize,
      sha256: artifact.sha256,
      recordCount: artifact.recordCount,
    },
    verification: {
      status: "verified" as const,
      verified: true as const,
      expectedSha256: verification.expectedSha256,
      actualSha256: verification.actualSha256,
      byteSize: verification.byteSize,
    },
    qr,
    policy: {
      ...policyContext,
      issuedAt: qr.issuedAt,
      expiresAt: qr.expiresAt,
    },
  };
  const bytes = input.receiptFormat === "csv" ? buildReceiptCsvBytes(baseReceipt) : buildReceiptPdfBytes(baseReceipt);
  const receipt: GovernanceAuditVerificationReceipt = {
    status: "issued",
    receipt: {
      ...baseReceipt,
      receiptByteSize: bytes.byteLength,
      receiptSha256: sha256(bytes),
      bytesBase64: bytes.toString("base64"),
    },
  }.receipt;
  try {
    await indexGovernanceAuditVerificationReceipt({
      ownerOpenId,
      receiptId: receipt.receiptId,
      receiptFormat: receipt.receiptFormat,
      receiptSha256: receipt.receiptSha256,
      receiptByteSize: receipt.receiptByteSize,
      verificationStatus: receipt.verification.status,
      verificationAt: receipt.verificationAt,
      issuedByOpenId: ownerOpenId,
      exportId: receipt.export.exportId,
      exportFormat: receipt.export.format,
      exportGeneratedAt: receipt.export.generatedAt,
      exportScope: receipt.export.scope,
      exportByteSize: receipt.export.byteSize,
      exportSha256: receipt.export.sha256,
      exportRecordCount: receipt.export.recordCount,
      qrReferenceId: receipt.qr.referenceId,
      qrIssuedAt: receipt.qr.issuedAt,
      qrExpiresAt: receipt.qr.expiresAt,
      policyEventId: receipt.policy.policyEventId,
      policyPreviousValidityMinutes: receipt.policy.previousValidityMinutes,
      policyValidityMinutes: receipt.policy.validityMinutes,
      policyDifferenceMinutes: receipt.policy.differenceMinutes,
      policyChange: receipt.policy.change,
    });
  } catch {
    return { status: "receipt_index_failed", message: "Metadata receipt tidak dapat disimpan dengan aman. Bukti tidak diterbitkan; ekspor dan QR yang ada tidak diubah." };
  }
  issuedReceiptCache.set(issuedReceiptCacheKey(ownerOpenId, receipt), { ...receipt, ownerOpenId });
  return { status: "issued", receipt };
}
