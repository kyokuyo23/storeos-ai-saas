import { createHash } from "crypto";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import {
  getGeneratedGovernanceAuditExportForOwner,
  verifyGovernanceAuditExportBytes,
  type GovernanceAuditExportFormat,
} from "./governanceAuditExportIntegrity";
import { createGovernanceAuditVerificationQr, type GovernanceAuditVerificationQr } from "./governanceAuditVerificationQr";

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
  applicationVersion: "StoreOS Governance Audit v2.9";
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
  bytesBase64: string;
};

export type GovernanceAuditVerificationReceiptResult =
  | { status: "issued"; receipt: GovernanceAuditVerificationReceipt }
  | { status: "export_not_available"; message: string }
  | { status: "verification_failed"; message: string; expectedSha256?: string; actualSha256?: string };

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
    ["QR verification payload", receipt.qr.payload],
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
  input: { exportId: string; bytesBase64: string; receiptFormat: GovernanceAuditReceiptFormat },
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
  const qr = await createGovernanceAuditVerificationQr(ownerOpenId, artifact, receiptId, verificationAt);
  const baseReceipt = {
    kind: "storeos_governance_audit_verification_receipt" as const,
    version: 1 as const,
    receiptId,
    receiptFormat: input.receiptFormat,
    filename: `storeos-governance-audit-verification-receipt-${artifact.exportId}.${input.receiptFormat}`,
    contentType: (input.receiptFormat === "csv" ? "text/csv;charset=utf-8" : "application/pdf") as GovernanceAuditVerificationReceipt["contentType"],
    verificationAt,
    verificationAtWib: wibTime(verificationAt),
    applicationVersion: "StoreOS Governance Audit v2.9" as const,
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
  };
  const bytes = input.receiptFormat === "csv" ? buildReceiptCsvBytes(baseReceipt) : buildReceiptPdfBytes(baseReceipt);
  return {
    status: "issued",
    receipt: {
      ...baseReceipt,
      receiptByteSize: bytes.byteLength,
      receiptSha256: sha256(bytes),
      bytesBase64: bytes.toString("base64"),
    },
  };
}
