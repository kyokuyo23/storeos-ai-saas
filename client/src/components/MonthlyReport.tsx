import { AlertTriangle, Archive, CheckCircle2, Clock3, Copy, Download, FileText, History, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { downloadMonthlyReportCsv, printMonthlyReport } from "@/lib/monthlyReportExports";
import { downloadGovernanceAuditIntegrityArtifact, downloadGovernanceAuditVerificationReceipt, governanceAuditFilterScope, type GovernanceAuditExportData, type GovernanceAuditIntegrityArtifact } from "@/lib/governanceAuditExports";
import { AppShell, ErrorState, PageHeader, Panel } from "./FoundationShell";
import { useAuth } from "../_core/hooks/useAuth";
import { startLogin } from "@/const";
import "./monthly-report-governance.css";

const currency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2024, index, 1)));
const currentJakarta = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "numeric" }).formatToParts(new Date());
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value) };
};

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

type IntegrityStatus = "available" | "missing" | "corrupt" | "retired" | "archived";
type LifecycleStatus = "generated" | "verified" | "retained" | "eligible_for_archive" | "archived";
const artifactStatusLabel: Record<IntegrityStatus, string> = { available: "Terverifikasi", missing: "Tidak ditemukan", corrupt: "Checksum gagal", retired: "Masa simpan berakhir", archived: "Diarsipkan" };
const artifactStatusClass: Record<IntegrityStatus, string> = { available: "success", missing: "warning", corrupt: "danger", retired: "neutral", archived: "neutral" };
const lifecycleLabel: Record<LifecycleStatus, string> = { generated: "Dihasilkan", verified: "Terverifikasi", retained: "Disimpan aktif", eligible_for_archive: "Siap diarsipkan", archived: "Diarsipkan" };
const lifecycleClass: Record<LifecycleStatus, string> = { generated: "neutral", verified: "success", retained: "success", eligible_for_archive: "warning", archived: "neutral" };
const fileSize = (bytes: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes < 1024 ? bytes : bytes / 1024) + (bytes < 1024 ? " B" : " KB");
const wibTime = (value: Date | string) => `${new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
const jakartaYearMonth = (value: Date | string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "numeric" }).formatToParts(new Date(value));
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value) };
};
const retainedAgeMonths = (generatedAt: Date | string) => {
  const generated = jakartaYearMonth(generatedAt);
  const now = currentJakarta();
  return Math.max(0, (now.year - generated.year) * 12 + now.month - generated.month);
};

function ArtifactDownload({ year, month, kind, status }: { year: number; month: number; kind: "csv" | "html" | "pdf"; status: IntegrityStatus }) {
  const extension = kind === "html" ? "HTML" : kind.toUpperCase();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const download = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`/api/reports/monthly-artifacts/${year}/${month}/${kind}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Artifact verification failed");
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `storeos-management-report-${year}-${String(month).padStart(2, "0")}.${kind}`;
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setDownloadError("Unduhan ditolak karena artefak tidak dapat diverifikasi.");
    } finally {
      setIsDownloading(false);
    }
  };
  if (status !== "available") return <span className="artifact-unavailable">{extension} tidak tersedia</span>;
  return <div className="artifact-download-control"><button type="button" className="button secondary compact-button" onClick={() => void download()} disabled={isDownloading} aria-label={`Unduh ${extension}`}><Download size={13} /> {isDownloading ? "Memuat" : extension}</button>{downloadError && <span role="alert" className="artifact-download-error">{downloadError}</span>}</div>;
}

function GovernancePanel({ enabled }: { enabled: boolean }) {
  const governanceQuery = trpc.reports.monthlyArtifactGovernance.useQuery(undefined, { enabled, retry: false, refetchOnWindowFocus: false });
  if (!enabled) return null;
  return <Panel title="Governance artefak laporan" description="Visibilitas owner-admin atas retensi, integritas, dan lifecycle artefak. Riwayat audit tetap dipertahankan ketika artefak melewati masa simpan.">
    {governanceQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat governance artefak…</div> : governanceQuery.isError ? <ErrorState message="Governance artefak tidak dapat dimuat." /> : governanceQuery.data ? (() => {
      const governance = governanceQuery.data;
      const integrity = governance.integrityCounts;
      const hasIntegrityIssue = integrity.missing > 0 || integrity.corrupt > 0;
      return <div className="governance-stack">
        <div className="governance-grid">
          <Metric label="Artefak aktif tersimpan" value={number(governance.retainedArtifactCount)} detail="Hanya metadata produksi aktif" />
          <Metric label="Format aktif" value={`${governance.artifactTypeCounts.csv} CSV · ${governance.artifactTypeCounts.pdf} PDF · ${governance.artifactTypeCounts.html} HTML`} detail="Setiap artefak aktif diverifikasi di server" />
          <Metric label="Laporan aktif tertua" value={governance.oldestRetainedReport ? `${months[governance.oldestRetainedReport.month - 1]} ${governance.oldestRetainedReport.year}` : "Belum ada"} detail={governance.oldestRetainedReport ? wibTime(governance.oldestRetainedReport.generatedAt) : "Menunggu laporan periode selesai"} />
          <Metric label="Mendekati arsip" value={number(governance.approachingArchive.length)} detail={`Dalam kebijakan ${governance.retentionMonths} bulan · pantau ${governance.archiveWarningWindowDays} hari terakhir`} />
        </div>
        <div className={`governance-integrity ${hasIntegrityIssue ? "attention" : "healthy"}`}><div>{hasIntegrityIssue ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}</div><div><strong>{hasIntegrityIssue ? "Perlu tindak lanjut integritas" : "Integritas artefak aktif sehat"}</strong><p>{integrity.available} file aktif tervalidasi · {integrity.missing} tidak ditemukan · {integrity.corrupt} checksum gagal. Artefak corrupt, missing, retired, atau archived tidak pernah dilayani oleh rute unduh aktif.</p></div></div>
        <div className="lifecycle-summary" aria-label="Ringkasan lifecycle artefak"><span className={`badge ${lifecycleClass.generated}`}>Dihasilkan {governance.lifecycleCounts.generated}</span><span className={`badge ${lifecycleClass.verified}`}>Terverifikasi {governance.lifecycleCounts.verified}</span><span className={`badge ${lifecycleClass.retained}`}>Aktif {governance.lifecycleCounts.retained}</span><span className={`badge ${lifecycleClass.eligible_for_archive}`}>Siap arsip {governance.lifecycleCounts.eligible_for_archive}</span><span className={`badge ${lifecycleClass.archived}`}>Diarsipkan {governance.lifecycleCounts.archived}</span></div>
        {governance.approachingArchive.length ? <div className="governance-approaching"><div className="governance-section-heading"><Clock3 size={16} /><strong>Mendekati ambang retensi</strong></div><ul>{governance.approachingArchive.map((artifact) => <li key={`${artifact.year}-${artifact.month}`}><span>{months[artifact.month - 1]} {artifact.year}</span><span className={`badge ${lifecycleClass[artifact.lifecycleStatus as LifecycleStatus]}`}>{lifecycleLabel[artifact.lifecycleStatus as LifecycleStatus]}</span><small>{artifact.daysUntilArchive > 0 ? `${artifact.daysUntilArchive} hari menuju ambang arsip` : "Memenuhi syarat arsip"}</small></li>)}</ul></div> : <div className="governance-empty"><Archive size={17} /><span>Tidak ada artefak aktif yang mendekati ambang arsip.</span></div>}
        <p className="settings-help"><ShieldCheck size={14} /> Lifecycle: Dihasilkan → Terverifikasi → Disimpan aktif → Siap diarsipkan → Diarsipkan. Pengarsipan bersifat idempoten, menonaktifkan unduhan aktif, dan mempertahankan metadata serta jejak audit.</p>
      </div>;
    })() : null}
  </Panel>;
}

function GovernanceAuditExportPanel({ enabled, initialYear }: { enabled: boolean; initialYear: number }) {
  const [auditYear, setAuditYear] = useState<number | "all">("all");
  const [auditMonth, setAuditMonth] = useState<number | "all">("all");
  const [auditLifecycle, setAuditLifecycle] = useState<LifecycleStatus | "all">("all");
  const [auditFormat, setAuditFormat] = useState<"csv" | "html" | "pdf" | "all">("all");
  const [auditScope, setAuditScope] = useState<"active" | "archived_or_retired" | "all">("all");
  const input = useMemo(() => ({
    ...(auditYear === "all" ? {} : { year: auditYear }),
    ...(auditMonth === "all" ? {} : { month: auditMonth }),
    ...(auditLifecycle === "all" ? {} : { lifecycleStatus: auditLifecycle }),
    ...(auditFormat === "all" ? {} : { artifactFormat: auditFormat }),
    ...(auditScope === "all" ? {} : { artifactScope: auditScope }),
  }), [auditYear, auditMonth, auditLifecycle, auditFormat, auditScope]);
  const auditQuery = trpc.reports.monthlyArtifactGovernanceAuditExport.useQuery(input, { enabled, retry: false, refetchOnWindowFocus: false });
  const exportMutation = trpc.reports.generateMonthlyArtifactGovernanceAuditExport.useMutation();
  const verifyMutation = trpc.reports.verifyMonthlyArtifactGovernanceAuditExport.useMutation();
  const receiptMutation = trpc.reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt.useMutation();
  const [latestExport, setLatestExport] = useState<(GovernanceAuditIntegrityArtifact & {
    generatedAt: Date | string;
    timezone: "Asia/Jakarta";
    scope: string;
    recordCount: number;
    byteSize: number;
    sha256: string;
  }) | null>(null);
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"unknown" | "verified" | "failed">("unknown");
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<{
    receiptId: string;
    qr: { referenceId: string; verificationUrl: string; imageDataUrl: string; expiresAt: Date | string; verificationStatus: "verified" };
  } | null>(null);
  if (!enabled) return null;
  const audit = auditQuery.data as GovernanceAuditExportData | undefined;
  const verifyLatestExport = (artifact = latestExport) => {
    if (!artifact) return;
    setIntegrityMessage(null);
    setReceiptMessage(null);
    verifyMutation.mutate({ exportId: artifact.exportId, bytesBase64: artifact.bytesBase64 }, {
      onSuccess: (verification) => {
        setVerificationStatus(verification.verified ? "verified" : "failed");
        setIntegrityMessage(verification.verified
          ? `Terverifikasi server · ${verification.byteSize} byte · SHA-256 cocok.`
          : `HASH TIDAK COCOK · SHA-256 aktual tidak sama dengan metadata ekspor.`);
      },
      onError: () => {
        setVerificationStatus("failed");
        setIntegrityMessage("Verifikasi server gagal. Byte ekspor tidak diterima sebagai artefak valid.");
      },
    });
  };
  const generateAndDownload = (format: "csv" | "pdf") => {
    setIntegrityMessage(null);
    setCopyMessage(null);
    exportMutation.mutate({ ...input, format }, {
      onSuccess: (artifact) => {
        setLatestExport(artifact);
        setVerificationStatus("unknown");
        setReceiptMessage(null);
        setLatestReceipt(null);
        downloadGovernanceAuditIntegrityArtifact(artifact);
        verifyLatestExport(artifact);
      },
      onError: () => setIntegrityMessage("Ekspor audit tidak dapat dibuat. Pastikan akses owner-admin masih aktif."),
    });
  };
  const copyHash = async () => {
    if (!latestExport) return;
    try {
      await navigator.clipboard.writeText(latestExport.sha256);
      setCopyMessage("Hash disalin.");
    } catch {
      setCopyMessage("Hash tersedia untuk disalin dari kolom di bawah.");
    }
  };
  const downloadReceipt = (receiptFormat: "csv" | "pdf") => {
    if (!latestExport || verificationStatus !== "verified") return;
    setReceiptMessage(null);
    receiptMutation.mutate({ exportId: latestExport.exportId, bytesBase64: latestExport.bytesBase64, receiptFormat }, {
      onSuccess: (result) => {
        if (result.status !== "issued") {
          setReceiptMessage(result.message);
          return;
        }
        downloadGovernanceAuditVerificationReceipt(result.receipt);
        setLatestReceipt(result.receipt);
        setReceiptMessage(`Bukti verifikasi ${result.receipt.receiptFormat.toUpperCase()} diunduh · ${fileSize(result.receipt.receiptByteSize)} · SHA-256 ${result.receipt.receiptSha256.slice(0, 12)}…`);
      },
      onError: () => setReceiptMessage("Bukti verifikasi tidak dapat diterbitkan. Tidak ada ekspor atau lifecycle yang diubah."),
    });
  };
  return <Panel className="governance-audit-export-panel" title="Ekspor Audit Governance" description="Ekspor read-only jejak lifecycle yang sudah tersimpan. Filter diproses di server dalam scope owner-admin dan tidak mencatat event lifecycle baru.">
    <div className="governance-audit-stack">
      <div className="governance-audit-filters" aria-label="Filter ekspor audit governance">
        <label className="field"><span>Tahun periode</span><select aria-label="Tahun audit governance" className="form-input" value={auditYear} onChange={(event) => setAuditYear(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua tahun</option>{Array.from({ length: 8 }, (_, index) => initialYear - 5 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Bulan periode</span><select aria-label="Bulan audit governance" className="form-input" value={auditMonth} onChange={(event) => setAuditMonth(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua bulan</option>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
        <label className="field"><span>Lifecycle event</span><select aria-label="Lifecycle audit governance" className="form-input" value={auditLifecycle} onChange={(event) => setAuditLifecycle(event.target.value as LifecycleStatus | "all")}><option value="all">Semua lifecycle</option>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Format snapshot</span><select aria-label="Format audit governance" className="form-input" value={auditFormat} onChange={(event) => setAuditFormat(event.target.value as "csv" | "html" | "pdf" | "all")}><option value="all">Semua format</option><option value="csv">CSV</option><option value="pdf">PDF</option><option value="html">HTML</option></select></label>
        <label className="field"><span>Status artefak</span><select aria-label="Status artefak audit governance" className="form-input" value={auditScope} onChange={(event) => setAuditScope(event.target.value as "active" | "archived_or_retired" | "all")}><option value="all">Aktif, archived, dan retired</option><option value="active">Aktif saja</option><option value="archived_or_retired">Archived / retired</option></select></label>
      </div>
      {auditQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Menyiapkan audit governance…</div> : auditQuery.isError ? <ErrorState message="Ekspor audit governance tidak tersedia atau akses owner-admin ditolak." /> : audit ? <>
        <div className="governance-audit-summary"><div><span>Audit lifecycle</span><strong>{number(audit.recordCount)} record</strong><small>{governanceAuditFilterScope(audit)}</small></div><div><span>Dibuat pada</span><strong>{wibTime(audit.generatedAt)}</strong><small>Scope dan bytes ekspor dihitung server-side · {audit.timezone}</small></div><div className="governance-audit-actions"><button type="button" className="button secondary compact-button" onClick={() => generateAndDownload("csv")} disabled={exportMutation.isPending}><Download size={14} /> {exportMutation.isPending ? "Menyiapkan" : "CSV Audit"}</button><button type="button" className="button ghost compact-button" onClick={() => generateAndDownload("pdf")} disabled={exportMutation.isPending}><FileText size={14} /> PDF Audit</button></div></div>
        {latestExport && <div className="governance-export-integrity" aria-label="Integritas ekspor audit governance"><div className="governance-section-heading"><ShieldCheck size={16} /><strong>Integritas ekspor terbaru</strong><span className="badge success">Server-hashed</span></div><div className="governance-export-integrity-grid"><div><span>Format · ukuran</span><strong>{latestExport.format.toUpperCase()} · {fileSize(latestExport.byteSize)}</strong></div><div><span>Dibuat pada</span><strong>{wibTime(latestExport.generatedAt)}</strong></div><div className="integrity-scope"><span>Scope</span><strong>{latestExport.scope}</strong></div></div><div className="integrity-hash-row"><label htmlFor="governance-export-hash">SHA-256</label><input id="governance-export-hash" readOnly value={latestExport.sha256} aria-label="SHA-256 ekspor audit governance" /><button type="button" className="button ghost compact-button" onClick={() => void copyHash()}><Copy size={13} /> Salin</button></div><div className="integrity-verification-row"><button type="button" className="button secondary compact-button" onClick={() => verifyLatestExport()} disabled={verifyMutation.isPending}><RefreshCw size={13} /> {verifyMutation.isPending ? "Memverifikasi" : "Verifikasi ulang"}</button><small>Id: {latestExport.exportId}</small>{copyMessage && <span className="integrity-success">{copyMessage}</span>}{integrityMessage && <span role="status" className={verificationStatus === "verified" ? "integrity-success" : "integrity-error"}>{integrityMessage}</span>}</div><div className="verification-receipt-actions" aria-label="Bukti verifikasi ekspor audit"><div><strong>Bukti verifikasi</strong><small>Hanya diterbitkan setelah byte ekspor ini berhasil diverifikasi server-side.</small></div><div><button type="button" className="button secondary compact-button" onClick={() => downloadReceipt("csv")} disabled={verificationStatus !== "verified" || receiptMutation.isPending}><Download size={13} /> {receiptMutation.isPending ? "Menerbitkan" : "Bukti CSV"}</button><button type="button" className="button ghost compact-button" onClick={() => downloadReceipt("pdf")} disabled={verificationStatus !== "verified" || receiptMutation.isPending}><FileText size={13} /> Bukti PDF</button></div>{receiptMessage && <span role={receiptMessage.startsWith("Bukti verifikasi") ? "status" : "alert"} className={receiptMessage.startsWith("Bukti verifikasi") ? "integrity-success" : "integrity-error"}>{receiptMessage}</span>}</div>{latestReceipt && <section className="governance-qr-reference" aria-label="Referensi QR verifikasi audit"><img src={latestReceipt.qr.imageDataUrl} alt="QR untuk referensi verifikasi audit" /><div><strong>Referensi QR terverifikasi</strong><p>QR hanya memuat referensi aman, ID ekspor, ID bukti, dan status terverifikasi. QR tidak membuka unduhan artefak.</p><code>{latestReceipt.qr.referenceId}</code><small>Berlaku sampai {wibTime(latestReceipt.qr.expiresAt)}.</small><a className="button ghost compact-button" href={latestReceipt.qr.verificationUrl}>Buka hasil verifikasi QR</a></div></section>}</div>}
        {audit.records.length ? <div className="governance-audit-preview" aria-label="Pratinjau audit lifecycle"><div className="governance-section-heading"><History size={16} /><strong>Pratinjau event lifecycle</strong><small>{audit.recordCount} record sesuai filter</small></div><ul>{audit.records.map((record, index) => <li key={`${record.reportPeriod.year}-${record.reportPeriod.month}-${record.lifecycleStatus}-${record.occurredAt}-${record.artifactFormat}-${index}`}><div><strong>{months[record.reportPeriod.month - 1]} {record.reportPeriod.year}</strong><span className={`badge ${lifecycleClass[record.lifecycleStatus]}`}>{lifecycleLabel[record.lifecycleStatus]}</span><small>{wibTime(record.occurredAt)} · {record.source} · {record.actor}</small></div><div><span className="badge neutral">{record.artifactScope}</span><small>{record.artifactFormat.toUpperCase()} · {record.bytes === null ? "Snapshot tidak tersedia" : `${fileSize(record.bytes)} · SHA-256 ${record.sha256?.slice(0, 12)}…`}</small></div></li>)}</ul>{audit.recordCount > 5 && <p className="settings-help"><History size={14} /> Pratinjau menampilkan 5 event terbaru; CSV dan cetak memuat seluruh {audit.recordCount} record terfilter.</p>}</div> : <div className="empty-state artifact-empty"><div className="empty-icon"><History size={20} /></div><strong>Tidak ada event lifecycle untuk filter ini.</strong><p>CSV audit tetap dapat diunduh sebagai bukti filter, metadata, dan hasil kosong tanpa mengubah lifecycle artefak.</p></div>}
      </> : null}
    </div>
  </Panel>;
}

function LifecycleHistoryPanel({ selection, onClose }: { selection: { year: number; month: number } | null; onClose: () => void }) {
  const historyQuery = trpc.reports.monthlyArtifactLifecycleHistory.useQuery(selection ?? { year: 2000, month: 1 }, { enabled: Boolean(selection), retry: false, refetchOnWindowFocus: false });
  if (!selection) return null;
  const title = `${months[selection.month - 1]} ${selection.year}`;
  return <section className="lifecycle-history-panel" aria-label={`Riwayat Lifecycle ${title}`}>
    <div className="lifecycle-history-heading"><div><div className="eyebrow">RIWAYAT LIFECYCLE</div><h3>{title}</h3><p>Jejak audit read-only untuk perubahan lifecycle artefak. Metadata checksum disalin sebagai snapshot dan tidak membuka akses unduh.</p></div><button type="button" className="button ghost compact-button" onClick={onClose}><X size={15} /> Tutup</button></div>
    {historyQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat riwayat lifecycle…</div> : historyQuery.isError ? <ErrorState message="Riwayat lifecycle tidak dapat dimuat atau akses Anda tidak diizinkan." /> : !historyQuery.data ? <div className="empty-state artifact-empty"><div className="empty-icon"><History size={20} /></div><strong>Riwayat lifecycle tidak ditemukan.</strong><p>Periode ini tidak tersedia dalam scope pemilik StoreOS saat ini.</p></div> : <>
      <div className="lifecycle-current-state"><span>Lifecycle saat ini</span><strong className={`badge ${lifecycleClass[historyQuery.data.artifact.lifecycleStatus as LifecycleStatus]}`}>{lifecycleLabel[historyQuery.data.artifact.lifecycleStatus as LifecycleStatus]}</strong><small>Dibuat {wibTime(historyQuery.data.artifact.generatedAt)}</small></div>
      {historyQuery.data.events.length ? <ol className="lifecycle-timeline">{historyQuery.data.events.map((event, index) => <li key={`${event.lifecycleStatus}-${event.occurredAt}-${index}`} className="lifecycle-event"><div className={`timeline-marker ${lifecycleClass[event.lifecycleStatus as LifecycleStatus]}`} aria-hidden="true" /><div className="lifecycle-event-card"><div className="lifecycle-event-topline"><strong>{lifecycleLabel[event.lifecycleStatus as LifecycleStatus]}</strong><time>{wibTime(event.occurredAt)}</time></div><p>{event.reason ?? "Perubahan lifecycle tercatat."}</p><dl className="lifecycle-event-meta"><div><dt>Sumber / aktor</dt><dd>{event.source} · {event.actor}</dd></div><div><dt>Format</dt><dd>{event.artifactFormat}</dd></div><div><dt>Periode</dt><dd>{months[event.reportPeriod.month - 1]} {event.reportPeriod.year} · {event.reportPeriod.timezone}</dd></div></dl><div className="lifecycle-integrity-snapshot" aria-label="Snapshot integritas"><span>Snapshot integritas</span>{event.integrity.map((item) => <small key={item.kind}>{item.kind.toUpperCase()} · {fileSize(item.bytes)} · SHA-256 {item.sha256.slice(0, 12)}…</small>)}</div></div></li>)}</ol> : <div className="empty-state artifact-empty"><div className="empty-icon"><History size={20} /></div><strong>Belum ada event lifecycle.</strong><p>Riwayat akan terisi secara deterministik ketika metadata artefak melewati transisi lifecycle.</p></div>}
    </>}
  </section>;
}

function ArchiveConfirmationPanel({ selection, onClose }: { selection: { year: number; month: number; lifecycleStatus: LifecycleStatus; generatedAt: Date | string } | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [outcome, setOutcome] = useState<string | null>(null);
  const archiveMutation = trpc.reports.archiveMonthlyArtifact.useMutation({
    onSuccess: async (result) => {
      const messages: Record<string, string> = {
        archived: "Artefak berhasil diarsipkan. Metadata dan riwayat lifecycle tetap dipertahankan.",
        already_archived: "Artefak ini sudah diarsipkan sebelumnya. Tidak ada perubahan tambahan.",
        not_eligible: "Artefak tidak lagi memenuhi syarat untuk diarsipkan.",
        integrity_failed: "Pengarsipan ditolak karena integritas artefak tidak dapat diverifikasi.",
        not_found: "Artefak tidak ditemukan dalam scope pemilik StoreOS.",
      };
      setOutcome(messages[result.outcome] ?? "Status pengarsipan tidak diketahui.");
      await Promise.all([
        utils.reports.monthlyArtifacts.invalidate(),
        utils.reports.monthlyArtifactGovernance.invalidate(),
        utils.reports.monthlyArtifactLifecycleHistory.invalidate(),
      ]);
    },
  });
  if (!selection) return null;
  const period = `${months[selection.month - 1]} ${selection.year}`;
  const eligible = selection.lifecycleStatus === "eligible_for_archive";
  const retentionAge = retainedAgeMonths(selection.generatedAt);
  const approveArchive = () => archiveMutation.mutate({ year: selection.year, month: selection.month });
  return <section className="archive-confirmation-panel" aria-label={`Konfirmasi arsip ${period}`}>
    <div className="archive-confirmation-heading"><div><div className="eyebrow">PERSETUJUAN PEMILIK</div><h3>Arsipkan {period}?</h3><p><strong>Usia retensi: sekitar {retentionAge} bulan</strong> sejak dibuat pada {wibTime(selection.generatedAt)}. Ini hanya mengarsipkan artefak laporan yang dipilih; data Financial Core, Inventory Intelligence, ledger, dan sumber laporan tidak akan diubah.</p></div><button type="button" className="button ghost compact-button" onClick={onClose}><X size={15} /> Tutup</button></div>
    <div className="archive-confirmation-notice"><AlertTriangle size={18} /><div><strong>Unduhan aktif akan dinonaktifkan.</strong><p>Server akan memverifikasi SHA-256 dan ukuran CSV, HTML, serta PDF sebelum transisi. Metadata, checksum, dan Riwayat Lifecycle tetap dipertahankan.</p></div></div>
    {!eligible && <div role="alert" className="archive-confirmation-error">Artefak ini tidak memenuhi status “Siap diarsipkan”. Server tetap akan menolak transisi yang tidak valid.</div>}
    {outcome && <div role={archiveMutation.data?.outcome === "archived" || archiveMutation.data?.outcome === "already_archived" ? "status" : "alert"} className={archiveMutation.data?.outcome === "archived" || archiveMutation.data?.outcome === "already_archived" ? "archive-confirmation-success" : "archive-confirmation-error"}>{outcome}</div>}
    {archiveMutation.isError && <div role="alert" className="archive-confirmation-error">Pengarsipan gagal. Tidak ada data sumber laporan yang diubah.</div>}
    <div className="archive-confirmation-actions"><button type="button" className="button ghost" onClick={onClose}>Batalkan</button><button type="button" className="button danger compact-button" onClick={approveArchive} disabled={!eligible || archiveMutation.isPending || Boolean(outcome)}><Archive size={14} /> {archiveMutation.isPending ? "Memverifikasi…" : "Setujui & Arsipkan"}</button></div>
  </section>;
}

export function MonthlyReport() {
  const initial = useMemo(currentJakarta, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [artifactYear, setArtifactYear] = useState(initial.year);
  const [artifactMonth, setArtifactMonth] = useState<number | "all">("all");
  const [historyPeriod, setHistoryPeriod] = useState<{ year: number; month: number } | null>(null);
  const [archivePeriod, setArchivePeriod] = useState<{ year: number; month: number; lifecycleStatus: LifecycleStatus; generatedAt: Date | string } | null>(null);
  const auth = useAuth();
  const isOwnerAdmin = auth.isAuthenticated && auth.user?.role === "admin";
  const query = trpc.reports.monthlySummary.useQuery({ year, month });
  const artifactsQuery = trpc.reports.monthlyArtifacts.useQuery(
    { year: artifactYear, ...(artifactMonth === "all" ? {} : { month: artifactMonth }) },
    { enabled: isOwnerAdmin, retry: false, refetchOnWindowFocus: false },
  );
  const report = query.data;
  const downloadCsv = () => { if (report) downloadMonthlyReportCsv(report); };
  return <AppShell active="reports" eyebrow="Management Reporting" title="Monthly Summary">
    <PageHeader eyebrow="MONTHLY REPORTING" title="Ringkasan Manajemen Bulanan" description="Financial Core dan Inventory Intelligence dalam satu laporan read-only berbasis kalender Jakarta/WIB." action={<div className="header-actions"><button className="button secondary" onClick={downloadCsv} disabled={!report}><Download size={16} /> CSV</button><button className="button ghost" onClick={() => printMonthlyReport(report)} disabled={!report}><FileText size={16} /> PDF / Cetak</button></div>} />
    <Panel title="Periode laporan" description="Batas laporan memakai 00:00 WIB pada hari pertama sampai sebelum 00:00 WIB bulan berikutnya."><div className="form-grid report-period-controls"><label className="field"><span>Tahun</span><select className="form-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => initial.year - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Bulan</span><select className="form-input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label><div className="report-period-label"><span>Periode aktif</span><strong>{report?.period.label ?? `${months[month - 1]} ${year}`}</strong><small>{report?.period.startDate ?? "—"} s/d {report?.period.endDate ?? "—"} · Asia/Jakarta</small></div></div></Panel>
    {query.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat laporan bulanan…</div> : query.isError ? <ErrorState message="Laporan bulanan tidak dapat dimuat. Silakan coba lagi." /> : report ? <div className="monthly-report-grid"><Panel title="Financial Core" description="Nilai yang sudah mengikuti pembatalan, refund, dan exchange sesuai Financial Core."><div className="summary-grid"><Metric label="Gross Sales" value={currency(report.financial.grossSales)} /><Metric label="Net Revenue" value={currency(report.financial.netRevenue)} /><Metric label="COGS" value={currency(report.financial.cogs)} /><Metric label="Gross Profit" value={currency(report.financial.grossProfit)} /><Metric label="Gross Margin" value={`${number(report.financial.grossMargin)}%`} /><Metric label="Sales" value={number(report.financial.salesTransactionCount)} /><Metric label="Refund Value" value={currency(report.financial.refundValue)} /><Metric label="Void Value" value={currency(report.financial.voidValue)} /><Metric label="Exchange Impact" value={currency(report.financial.exchangeImpact)} /></div></Panel><Panel title="Inventory Intelligence" description="Rekonsiliasi memakai inventory ledger dan tolerance engine yang sudah ada."><div className="summary-grid"><Metric label="Opening Stock" value={number(report.inventory.openingStock)} /><Metric label="Expected Stock" value={number(report.inventory.expectedStock)} /><Metric label="Actual / Closing Stock" value={number(report.inventory.actualStock)} /><Metric label="Total Variance" value={number(report.inventory.totalVariance)} /><Metric label="Di luar toleransi" value={number(report.inventory.outOfToleranceItemCount)} /><Metric label="High-value variance" value={number(report.inventory.highValueVarianceCount)} /><Metric label="Varians tinggi berulang" value={number(report.inventory.recurringHighVarianceIngredientCount)} detail="2/3 atau 3/3 periode comparable" /><Metric label="Sesi stock-opname" value={number(report.inventory.stockOpnameSessionCount)} /><Metric label="Follow-up terbuka" value={number(report.inventory.openStockOpnameFollowUpCount)} /></div></Panel></div> : <Panel title="Tidak ada data" description="Belum ada data transaksi atau pergerakan untuk bulan Jakarta/WIB yang dipilih."><div className="empty-state">Belum ada data pada periode yang dipilih.</div></Panel>}
    {report && <Panel title="Metadata laporan" description="Metadata ini ikut tersedia pada CSV dan tampilan cetak/PDF."><div className="report-metadata"><div><span>Dibuat pada</span><strong>{report.generatedAt ? wibTime(report.generatedAt) : "—"}</strong></div><div><span>Catatan audit</span>{(report.auditNotes ?? []).length ? <ul>{(report.auditNotes ?? []).map((entry, index) => <li key={`${entry.reference}-${entry.type}-${index}`}><strong>{entry.reference}</strong> · {entry.note}</li>)}</ul> : <strong>Tidak ada catatan audit pada periode ini.</strong>}</div></div></Panel>}
    <Panel title="Artefak laporan tersimpan" description="CSV, PDF, dan HTML yang tersimpan untuk periode selesai. Akses dan unduhan hanya tersedia bagi pemilik StoreOS setelah checksum tervalidasi di server.">
      {!auth.isAuthenticated ? <div className="artifact-access-state"><ShieldCheck size={22} /><div><strong>Masuk sebagai pemilik untuk membuka arsip.</strong><p>Ringkasan bulanan tetap tersedia secara read-only. Artefak tersimpan memakai akses server-side yang dibatasi.</p></div><button className="button primary" onClick={() => startLogin()}>Masuk</button></div> : auth.user?.role !== "admin" ? <div className="artifact-access-state restricted"><AlertTriangle size={22} /><div><strong>Arsip laporan dibatasi.</strong><p>Akun ini tidak memiliki akses pemilik untuk artefak Management Reports.</p></div></div> : <>
        <div className="artifact-filter-row"><label className="field"><span>Tahun arsip</span><select aria-label="Tahun arsip" className="form-input" value={artifactYear} onChange={(event) => setArtifactYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => initial.year - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Bulan arsip</span><select aria-label="Bulan arsip" className="form-input" value={artifactMonth} onChange={(event) => setArtifactMonth(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua bulan</option>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label></div>
        {artifactsQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memverifikasi artefak tersimpan…</div> : artifactsQuery.isError ? <ErrorState message="Arsip laporan tidak dapat dimuat atau akses Anda tidak diizinkan." /> : artifactsQuery.data?.length ? <div className="artifact-table-wrap"><table className="artifact-table"><thead><tr><th>Periode</th><th>Dibuat (WIB)</th><th>Lifecycle</th><th>CSV</th><th>PDF</th><th>HTML</th><th>Kontrol</th></tr></thead><tbody>{artifactsQuery.data.map((artifact) => <tr key={artifact.id}><td><strong>{months[artifact.month - 1]} {artifact.year}</strong><small>{artifact.periodStartDate} s/d {artifact.periodEndDate}</small></td><td>{wibTime(artifact.generatedAt)}</td><td><span className={`badge ${lifecycleClass[artifact.lifecycleStatus as LifecycleStatus]}`}>{lifecycleLabel[artifact.lifecycleStatus as LifecycleStatus]}</span></td>{([artifact.csv, artifact.pdf, artifact.printableHtml] as const).map((file) => <td key={file.kind}><span className={`badge ${artifactStatusClass[file.status as IntegrityStatus]}`}>{artifactStatusLabel[file.status as IntegrityStatus]}</span><small>{fileSize(file.bytes)} · SHA-256</small></td>)}<td><div className="artifact-download-actions"><ArtifactDownload year={artifact.year} month={artifact.month} kind="csv" status={artifact.csv.status as IntegrityStatus} /><ArtifactDownload year={artifact.year} month={artifact.month} kind="pdf" status={artifact.pdf.status as IntegrityStatus} /><ArtifactDownload year={artifact.year} month={artifact.month} kind="html" status={artifact.printableHtml.status as IntegrityStatus} /><button type="button" className="button ghost compact-button lifecycle-history-action" onClick={() => setHistoryPeriod({ year: artifact.year, month: artifact.month })}><History size={14} /> Riwayat Lifecycle</button>{artifact.lifecycleStatus === "eligible_for_archive" && <button type="button" className="button danger compact-button archive-action" onClick={() => setArchivePeriod({ year: artifact.year, month: artifact.month, lifecycleStatus: artifact.lifecycleStatus as LifecycleStatus, generatedAt: artifact.generatedAt })}><Archive size={14} /> Arsipkan</button>}</div></td></tr>)}</tbody></table></div> : <div className="empty-state artifact-empty"><div className="empty-icon"><Archive size={20} /></div><strong>Belum ada artefak tersimpan untuk filter ini.</strong><p>Artefak akan muncul setelah laporan bulanan periode selesai dibuat dan melewati verifikasi integritas.</p></div>}
        <LifecycleHistoryPanel selection={historyPeriod} onClose={() => setHistoryPeriod(null)} />
        <ArchiveConfirmationPanel selection={archivePeriod} onClose={() => setArchivePeriod(null)} />
      </>}
    </Panel>
    <GovernancePanel enabled={isOwnerAdmin} />
    <GovernanceAuditExportPanel enabled={isOwnerAdmin} initialYear={initial.year} />
    <p className="settings-help"><RefreshCw size={14} /> Laporan dan governance ini bersifat read-only serta tidak mengubah penjualan, ledger, stock-opname, atau Financial Core.</p>
  </AppShell>;
}
