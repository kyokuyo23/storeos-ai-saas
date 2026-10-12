import { AlertTriangle, Archive, CheckCircle2, Clock3, Copy, Download, FileText, History, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { downloadMonthlyReportCsv, printMonthlyReport } from "@/lib/monthlyReportExports";
import { downloadGovernanceAuditIntegrityArtifact, downloadGovernanceAuditVerificationReceipt, governanceAuditFilterScope, type GovernanceAuditExportData, type GovernanceAuditIntegrityArtifact } from "@/lib/governanceAuditExports";
import { getFocusedMonthForReportReviewPreset, getReportReviewPath, parseReportReviewUrlState, reportReviewPresetOptions, type ReportArtifactListFormat, type ReportArtifactRetentionStatus, type ReportReviewPreset } from "@/lib/reportReviewUrlState";
import { AppShell, ErrorState, PageHeader, Panel } from "./FoundationShell";
import { RetentionSummaryExportPanel } from "./RetentionSummaryExportPanel";
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

type ActiveArtifactSummaryData = {
  activeArtifactCount: number;
  artifactTypeCounts: { csv: number; html: number; pdf: number };
  integrity: { verifiedBundleCount: number; excludedBundleCount: number };
  oldestActiveArtifact: { year: number; month: number; generatedAt: Date | string } | null;
  newestActiveArtifact: { year: number; month: number; generatedAt: Date | string } | null;
  range: { startWib: string | null; endWib: string | null };
  timezone: "Asia/Jakarta";
  calendarPeriodCount: number;
  retention: {
    retentionMonths: number;
    archiveWarningWindowDays: number;
    evaluatedAt: Date | string;
    normalArtifactCount: number;
    approachingArtifactCount: number;
    eligibleArtifactCount: number;
    approachingArtifactTypeCounts: { csv: number; html: number; pdf: number };
    oldestApproachingArtifact: { year: number; month: number; generatedAt: Date | string; archiveEligibleAt: Date | string } | null;
  };
};

function ActiveArtifactSummary({ summary, scopeLabel, onOpenList }: { summary: ActiveArtifactSummaryData; scopeLabel: string; onOpenList: (filter: { format?: ReportArtifactListFormat; integrity?: "healthy"; retentionStatus?: ReportArtifactRetentionStatus }) => void }) {
  const disabled = summary.activeArtifactCount === 0;
  return <section className="active-artifact-summary" aria-label="Ringkasan Artefak Aktif">
    <div className="active-artifact-context"><div><span>Periode dipilih</span><strong>{scopeLabel}</strong><small>{summary.range.startWib} sampai sebelum {summary.range.endWib}</small></div><div><span>Zona waktu</span><strong>{summary.timezone} (WIB)</strong><small>{summary.calendarPeriodCount} periode kalender · mulai inklusif, akhir eksklusif</small></div></div>
    <div className="active-artifact-metrics">
      <button type="button" className="summary-card active-artifact-summary-link" aria-label="Buka semua artefak aktif sesuai periode review" onClick={() => onOpenList({ integrity: "healthy" })} disabled={disabled}><span>Total aktif</span><strong>{number(summary.activeArtifactCount)} file</strong><small>{number(summary.integrity.verifiedBundleCount)} bundle laporan sehat</small></button>
      <button type="button" className="summary-card active-artifact-summary-link" aria-label="Buka artefak CSV aktif sesuai periode review" onClick={() => onOpenList({ format: "csv", integrity: "healthy" })} disabled={summary.artifactTypeCounts.csv === 0}><span>CSV</span><strong>{number(summary.artifactTypeCounts.csv)}</strong><small>Lihat daftar CSV aktif</small></button>
      <button type="button" className="summary-card active-artifact-summary-link" aria-label="Buka artefak HTML aktif sesuai periode review" onClick={() => onOpenList({ format: "html", integrity: "healthy" })} disabled={summary.artifactTypeCounts.html === 0}><span>HTML</span><strong>{number(summary.artifactTypeCounts.html)}</strong><small>Lihat daftar HTML aktif</small></button>
      <button type="button" className="summary-card active-artifact-summary-link" aria-label="Buka artefak PDF aktif sesuai periode review" onClick={() => onOpenList({ format: "pdf", integrity: "healthy" })} disabled={summary.artifactTypeCounts.pdf === 0}><span>PDF</span><strong>{number(summary.artifactTypeCounts.pdf)}</strong><small>Lihat daftar PDF aktif</small></button>
      <button type="button" className="summary-card active-artifact-summary-link retention-summary-link" aria-label="Buka artefak yang mendekati batas retensi" onClick={() => onOpenList({ integrity: "healthy", retentionStatus: "approaching" })} disabled={summary.retention.approachingArtifactCount === 0}><span>Mendekati batas retensi</span><strong>{number(summary.retention.approachingArtifactCount)} file</strong><small>{summary.retention.approachingArtifactTypeCounts.csv} CSV · {summary.retention.approachingArtifactTypeCounts.html} HTML · {summary.retention.approachingArtifactTypeCounts.pdf} PDF</small></button>
    </div>
    {summary.activeArtifactCount ? <div className="active-artifact-dates"><div><span>Artefak tertua</span><strong>{summary.oldestActiveArtifact ? `${months[summary.oldestActiveArtifact.month - 1]} ${summary.oldestActiveArtifact.year}` : "—"}</strong><small>{summary.oldestActiveArtifact ? wibTime(summary.oldestActiveArtifact.generatedAt) : "—"}</small></div><div><span>Artefak terbaru</span><strong>{summary.newestActiveArtifact ? `${months[summary.newestActiveArtifact.month - 1]} ${summary.newestActiveArtifact.year}` : "—"}</strong><small>{summary.newestActiveArtifact ? wibTime(summary.newestActiveArtifact.generatedAt) : "—"}</small></div><button type="button" className="active-artifact-integrity-link" aria-label="Buka artefak dengan integritas sehat sesuai periode review" onClick={() => onOpenList({ integrity: "healthy" })}><span>Integritas</span><strong className="badge success">{number(summary.integrity.verifiedBundleCount)} bundle tervalidasi</strong><small>Setiap CSV, HTML, dan PDF harus lolos verifikasi.</small></button></div> : <div className="empty-state artifact-empty"><div className="empty-icon"><Archive size={20} /></div><strong>Belum ada artefak aktif pada periode review ini.</strong><p>Artefak archived, retired, di luar scope, atau yang tidak lolos verifikasi tidak dihitung.</p></div>}
    {summary.integrity.excludedBundleCount > 0 && <p role="status" className="active-artifact-integrity-warning"><AlertTriangle size={15} /><span>{number(summary.integrity.excludedBundleCount)} bundle pada scope tidak ditampilkan sebagai aktif karena verifikasi artefak tidak lengkap. Tidak ada metadata atau lifecycle yang diubah.</span></p>}
    {summary.activeArtifactCount > 0 && <div className="active-artifact-retention" aria-label="Indikator retensi artefak"><div><span>Status retensi</span><strong>{summary.retention.eligibleArtifactCount > 0 ? "Memenuhi syarat retensi" : summary.retention.approachingArtifactCount > 0 ? "Mendekati batas retensi" : "Masih dalam masa retensi"}</strong><small>{number(summary.retention.normalArtifactCount)} file normal · {number(summary.retention.approachingArtifactCount)} file mendekati · {number(summary.retention.eligibleArtifactCount)} file memenuhi syarat</small></div><div className="retention-status-actions"><button type="button" className="badge success retention-status-link" onClick={() => onOpenList({ integrity: "healthy", retentionStatus: "normal" })} disabled={summary.retention.normalArtifactCount === 0}>Normal · {number(summary.retention.normalArtifactCount)}</button><button type="button" className="badge warning retention-status-link" onClick={() => onOpenList({ integrity: "healthy", retentionStatus: "approaching" })} disabled={summary.retention.approachingArtifactCount === 0}>Mendekati · {number(summary.retention.approachingArtifactCount)}</button><button type="button" className="badge danger retention-status-link" onClick={() => onOpenList({ integrity: "healthy", retentionStatus: "eligible" })} disabled={summary.retention.eligibleArtifactCount === 0}>Memenuhi syarat · {number(summary.retention.eligibleArtifactCount)}</button></div><div><span>Artefak mendekati tertua</span><strong>{summary.retention.oldestApproachingArtifact ? `${months[summary.retention.oldestApproachingArtifact.month - 1]} ${summary.retention.oldestApproachingArtifact.year}` : "—"}</strong><small>{summary.retention.oldestApproachingArtifact ? `Batas retensi ${wibTime(summary.retention.oldestApproachingArtifact.archiveEligibleAt)}` : "Tidak ada pada scope ini"}</small></div><div><span>Evaluasi retensi</span><strong>{summary.retention.retentionMonths} bulan · WIB</strong><small>{wibTime(summary.retention.evaluatedAt)} · jendela {summary.retention.archiveWarningWindowDays} hari</small></div></div>}
  </section>;
}

type IntegrityStatus = "available" | "missing" | "corrupt" | "retired" | "archived";
type LifecycleStatus = "generated" | "verified" | "retained" | "eligible_for_archive" | "archived";
const retentionStatusLabel: Record<ReportArtifactRetentionStatus, string> = { normal: "Masih dalam masa retensi", approaching: "Mendekati batas retensi", eligible: "Memenuhi syarat retensi" };
const retentionStatusClass: Record<ReportArtifactRetentionStatus, string> = { normal: "success", approaching: "warning", eligible: "danger" };
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

type QrExpiryPolicyHistoryEvent = {
  eventId: string;
  previousValidityMinutes: number;
  newValidityMinutes: number;
  resultingValidityMinutes: number;
  changedAt: Date | string;
  actorOpenId: string;
};

function QrExpiryPolicyHistory({ history, isLoading, isError, currentValidityMinutes }: { history: QrExpiryPolicyHistoryEvent[] | undefined; isLoading: boolean; isError: boolean; currentValidityMinutes: number }) {
  return <section className="governance-qr-policy-history" aria-label="Riwayat Kebijakan QR">
    <div className="governance-section-heading"><History size={16} /><div><strong>Riwayat Kebijakan QR</strong><small>Perubahan efektif dicatat append-only. QR yang telah diterbitkan mempertahankan waktu kedaluwarsanya.</small></div></div>
    {isLoading ? <div className="loading-state compact-loading"><span className="loading-dot" /> Memuat riwayat kebijakan QR…</div> : isError ? <p role="alert" className="integrity-error">Riwayat kebijakan QR tidak tersedia atau akses owner-admin ditolak.</p> : history?.length ? <ol className="governance-qr-policy-history-list">{history.map((event) => <li key={event.eventId}><div><strong>{event.previousValidityMinutes} → {event.newValidityMinutes} menit</strong><small>{wibTime(event.changedAt)} · oleh {event.actorOpenId}</small></div><code title={event.eventId}>{event.eventId}</code></li>)}</ol> : <div className="governance-qr-policy-history-empty"><History size={15} /><span>Belum ada perubahan kebijakan QR. Durasi aktif saat ini: {currentValidityMinutes} menit.</span></div>}
  </section>;
}

function GovernanceAuditQrReceiptPolicy({ policy }: { policy: { validityMinutes: number; previousValidityMinutes: number | null; change: "initial" | "increase" | "decrease" | "unchanged"; differenceMinutes: number; policyEventId: string | null; issuedAt: Date | string; expiresAt: Date | string } }) {
  const changeLabel = policy.change === "initial" ? "Initial policy" : policy.change === "increase" ? "Meningkat" : policy.change === "decrease" ? "Menurun" : "Tidak berubah";
  const previous = policy.previousValidityMinutes === null ? "Initial policy — no previous policy." : `${policy.previousValidityMinutes} menit`;
  return <section className="governance-qr-receipt-policy" aria-label="Snapshot kebijakan QR pada receipt">
    <div className="governance-section-heading"><Clock3 size={15} /><div><strong>Snapshot kebijakan QR</strong><small>Tersimpan pada receipt baru; perubahan berikutnya tidak mengubah snapshot ini.</small></div></div>
    <dl>
      <div><dt>Durasi</dt><dd>{policy.validityMinutes} menit</dd></div>
      <div><dt>Sebelumnya</dt><dd>{previous}</dd></div>
      <div><dt>Perubahan</dt><dd>{changeLabel} · {policy.differenceMinutes > 0 ? "+" : ""}{policy.differenceMinutes} menit</dd></div>
      <div><dt>Diterbitkan</dt><dd>{wibTime(policy.issuedAt)}</dd></div>
      <div><dt>Berakhir</dt><dd>{wibTime(policy.expiresAt)}</dd></div>
    </dl>
    <small className="governance-qr-policy-event">Event kebijakan: <code>{policy.policyEventId ?? "Initial policy — no previous policy."}</code></small>
  </section>;
}

type QrPolicyAuditDirection = "increase" | "decrease" | "initial" | "no_op";
type GovernanceAuditDatePreset = "today" | "last_7_days" | "last_30_days" | "current_month" | "previous_month" | "last_3_months" | "last_12_months" | "current_quarter" | "previous_quarter" | "current_year";

const governanceAuditDatePresetOptions: Array<{ value: GovernanceAuditDatePreset; label: string }> = [
  { value: "today", label: "Hari ini" }, { value: "last_7_days", label: "7 hari terakhir" }, { value: "last_30_days", label: "30 hari terakhir" }, { value: "current_month", label: "Bulan berjalan" }, { value: "previous_month", label: "Bulan sebelumnya" }, { value: "last_3_months", label: "3 bulan terakhir" }, { value: "last_12_months", label: "12 bulan terakhir" }, { value: "current_quarter", label: "Kuartal berjalan" }, { value: "previous_quarter", label: "Kuartal sebelumnya" }, { value: "current_year", label: "Tahun berjalan" },
];

function GovernanceAuditDateSearchFields({ ariaPrefix, datePreset, startDate, endDate, searchTerm, onDatePresetChange, onStartDateChange, onEndDateChange, onSearchTermChange, onClear }: { ariaPrefix: string; datePreset: GovernanceAuditDatePreset | "all"; startDate: string; endDate: string; searchTerm: string; onDatePresetChange: (value: GovernanceAuditDatePreset | "all") => void; onStartDateChange: (value: string) => void; onEndDateChange: (value: string) => void; onSearchTermChange: (value: string) => void; onClear: () => void }) {
  return <>
    <label className="field"><span>Rentang waktu</span><select className="form-input" aria-label={`Preset rentang ${ariaPrefix}`} value={datePreset} onChange={(event) => onDatePresetChange(event.target.value as GovernanceAuditDatePreset | "all")}><option value="all">Tanggal manual / semua</option>{governanceAuditDatePresetOptions.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select></label>
    <label className="field"><span>Mulai (WIB)</span><input className="form-input" aria-label={`Tanggal mulai ${ariaPrefix}`} type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} /></label>
    <label className="field"><span>Akhir (WIB)</span><input className="form-input" aria-label={`Tanggal akhir ${ariaPrefix}`} type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} /></label>
    <label className="field"><span>Cari</span><input className="form-input" aria-label={`Cari ${ariaPrefix}`} maxLength={160} value={searchTerm} placeholder="ID receipt, export, event, aktor, atau QR" onChange={(event) => onSearchTermChange(event.target.value)} /></label>
    <div className="field governance-audit-filter-action"><span>Filter aktif</span><button type="button" className="button ghost compact-button" onClick={onClear}>Hapus filter</button></div>
  </>;
}

function GovernanceAuditQrPolicyExportPanel({ enabled, reviewPreset }: { enabled: boolean; reviewPreset: ReportReviewPreset | null }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePreset, setDatePreset] = useState<GovernanceAuditDatePreset | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [direction, setDirection] = useState<QrPolicyAuditDirection | "all">("all");
  const [actorOpenId, setActorOpenId] = useState("");
  const [latestArtifact, setLatestArtifact] = useState<(GovernanceAuditIntegrityArtifact & { generatedAt: Date | string; timezone: "Asia/Jakarta"; scope: string; recordCount: number; byteSize: number; sha256: string }) | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"unknown" | "verified" | "failed">("unknown");
  const input = useMemo(() => ({
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(datePreset === "all" ? {} : { datePreset }),
    ...(searchTerm.trim() ? { searchTerm: searchTerm.trim() } : {}),
    ...(direction === "all" ? {} : { direction }),
    ...(actorOpenId.trim() ? { actorOpenId: actorOpenId.trim() } : {}),
    scope: "governance_audit_qr_expiry" as const,
  }), [actorOpenId, datePreset, direction, endDate, searchTerm, startDate]);
  const policyAuditQuery = trpc.reports.monthlyArtifactGovernanceAuditQrPolicyExport.useQuery(input, { enabled, retry: false, refetchOnWindowFocus: false });
  const exportMutation = trpc.reports.generateMonthlyArtifactGovernanceAuditQrPolicyExport.useMutation();
  const verifyMutation = trpc.reports.verifyMonthlyArtifactGovernanceAuditQrPolicyExport.useMutation();
  if (!enabled) return null;
  const audit = policyAuditQuery.data;
  const activeFilterLabel = [searchTerm.trim() ? `Cari: ${searchTerm.trim()}` : "", direction === "all" ? "" : `Arah: ${direction}`, actorOpenId.trim() ? `Aktor: ${actorOpenId.trim()}` : ""].filter(Boolean).join(" · ") || "Tidak ada";
  const verify = (artifact = latestArtifact) => {
    if (!artifact) return;
    setVerificationMessage(null);
    verifyMutation.mutate({ exportId: artifact.exportId, bytesBase64: artifact.bytesBase64 }, {
      onSuccess: (result) => {
        setVerificationStatus(result.verified ? "verified" : "failed");
        setVerificationMessage(result.verified ? `Terverifikasi server · ${result.byteSize} byte · SHA-256 cocok.` : "HASH TIDAK COCOK · byte yang diberikan berbeda dari ekspor server.");
      },
      onError: () => {
        setVerificationStatus("failed");
        setVerificationMessage("Verifikasi server gagal. Byte ekspor tidak diterima sebagai artefak valid.");
      },
    });
  };
  const generate = (format: "csv" | "pdf") => {
    setVerificationMessage(null);
    exportMutation.mutate({ ...input, format }, {
      onSuccess: (artifact) => {
        setLatestArtifact(artifact);
        setVerificationStatus("unknown");
        downloadGovernanceAuditIntegrityArtifact(artifact);
        verify(artifact);
      },
      onError: () => setVerificationMessage("Ekspor audit kebijakan QR tidak dapat dibuat. Pastikan filter dan akses owner-admin valid."),
    });
  };
  return <section className="governance-qr-policy-audit" aria-label="Ekspor Audit Kebijakan QR">
    <div className="governance-section-heading"><FileText size={16} /><div><strong>Ekspor Audit Kebijakan QR</strong><small>Snapshot read-only dari riwayat append-only. Batas tanggal diproses server-side di Jakarta/WIB; akhir tanggal bersifat eksklusif setelah hari yang dipilih.</small></div></div>
    <div className="governance-qr-policy-audit-filters">
      <GovernanceAuditDateSearchFields ariaPrefix="audit kebijakan QR" datePreset={datePreset} startDate={startDate} endDate={endDate} searchTerm={searchTerm} onDatePresetChange={setDatePreset} onStartDateChange={(value) => { setDatePreset("all"); setStartDate(value); }} onEndDateChange={(value) => { setDatePreset("all"); setEndDate(value); }} onSearchTermChange={setSearchTerm} onClear={() => { setDatePreset("all"); setStartDate(""); setEndDate(""); setSearchTerm(""); setDirection("all"); setActorOpenId(""); }} />
      <label className="field"><span>Arah perubahan</span><select className="form-input" aria-label="Arah audit kebijakan QR" value={direction} onChange={(event) => setDirection(event.target.value as QrPolicyAuditDirection | "all")}><option value="all">Semua arah</option><option value="initial">Initial</option><option value="increase">Meningkat</option><option value="decrease">Menurun</option><option value="no_op">Tidak berubah</option></select></label>
      <label className="field"><span>Aktor owner-admin</span><input className="form-input" aria-label="Aktor audit kebijakan QR" maxLength={64} value={actorOpenId} placeholder="Semua aktor" onChange={(event) => setActorOpenId(event.target.value)} /></label>
    </div>
    {reviewPreset && <div className="report-review-apply"><small>Preset review Reports tersedia: <strong>{reportReviewPresetOptions.find((option) => option.value === reviewPreset)?.label}</strong>. Filter audit yang ada tidak akan berubah sebelum diterapkan.</small><button type="button" className="button ghost compact-button" onClick={() => { setDatePreset(reviewPreset); setStartDate(""); setEndDate(""); }}>Gunakan periode review</button></div>}
    {policyAuditQuery.isLoading ? <div className="loading-state compact-loading"><span className="loading-dot" /> Memuat snapshot audit kebijakan QR…</div> : policyAuditQuery.isError ? <p role="alert" className="integrity-error">Audit kebijakan QR tidak tersedia atau akses owner-admin ditolak.</p> : audit ? <>
      <div className="governance-qr-policy-audit-summary"><div><span>Riwayat tersaring</span><strong>{number(audit.recordCount)} event</strong><small>Scope: governance_audit_qr_expiry</small></div><div><span>Rentang efektif</span><strong>{audit.filters.datePresetLabel ?? "Manual"}</strong><small>{audit.filters.startWib ?? "Tidak dibatasi"} s.d. {audit.filters.endWib ?? "Tidak dibatasi"}</small></div><div><span>Filter aktif</span><strong>{activeFilterLabel}</strong><small>Dicocokkan server-side</small></div><div><span>Dibuat pada</span><strong>{wibTime(audit.generatedAt)}</strong><small>{audit.filters.dateBoundary.replaceAll("_", " ")}</small></div><div className="governance-audit-actions"><button type="button" className="button secondary compact-button" onClick={() => generate("csv")} disabled={exportMutation.isPending}><Download size={14} /> {exportMutation.isPending ? "Menyiapkan" : "CSV Kebijakan"}</button><button type="button" className="button ghost compact-button" onClick={() => generate("pdf")} disabled={exportMutation.isPending}><FileText size={14} /> PDF Kebijakan</button></div></div>
      {audit.recordCount === 0 ? <div className="governance-qr-policy-history-empty"><History size={15} /><span>Tidak ada event kebijakan yang sesuai dengan filter saat ini. Ekspor tetap dapat dibuat sebagai snapshot kosong yang tervalidasi.</span></div> : <ol className="governance-qr-policy-history-list governance-qr-policy-audit-list">{audit.records.slice(0, 5).map((event) => <li key={event.eventId}><div><strong>{event.previousValidityMinutes ?? "Initial"} → {event.newValidityMinutes} menit · {event.direction}</strong><small>{wibTime(event.changedAt)} · oleh {event.actorOpenId} · {event.result}</small></div><code title={event.eventId}>{event.eventId}</code></li>)}</ol>}
      {latestArtifact && <div className="governance-export-integrity" aria-label="Integritas ekspor audit kebijakan QR"><div className="governance-section-heading"><ShieldCheck size={16} /><strong>Integritas ekspor kebijakan terbaru</strong><span className="badge success">Server-hashed</span></div><div className="governance-export-integrity-grid"><div><span>Format · ukuran</span><strong>{latestArtifact.format.toUpperCase()} · {fileSize(latestArtifact.byteSize)}</strong></div><div><span>Dibuat pada</span><strong>{wibTime(latestArtifact.generatedAt)}</strong></div><div className="integrity-scope"><span>Scope</span><strong>{latestArtifact.scope}</strong></div></div><div className="integrity-hash-row"><label htmlFor="qr-policy-audit-export-hash">SHA-256</label><input id="qr-policy-audit-export-hash" readOnly value={latestArtifact.sha256} aria-label="SHA-256 ekspor audit kebijakan QR" /><button type="button" className="button ghost compact-button" onClick={() => void navigator.clipboard.writeText(latestArtifact.sha256).catch(() => undefined)}><Copy size={13} /> Salin</button></div><div className="integrity-verification-row"><button type="button" className="button secondary compact-button" onClick={() => verify()} disabled={verifyMutation.isPending}><RefreshCw size={13} /> {verifyMutation.isPending ? "Memverifikasi" : "Verifikasi ulang"}</button><small>Id: {latestArtifact.exportId}</small>{verificationMessage && <span role="status" className={verificationStatus === "verified" ? "integrity-success" : "integrity-error"}>{verificationMessage}</span>}</div></div>}
    </> : null}
  </section>;
}

type QrPolicyReceiptAuditDirection = "increase" | "decrease" | "initial" | "unchanged";

function GovernanceAuditQrPolicyReceiptExportPanel({ enabled, reviewPreset }: { enabled: boolean; reviewPreset: ReportReviewPreset | null }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [datePreset, setDatePreset] = useState<GovernanceAuditDatePreset | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [direction, setDirection] = useState<QrPolicyReceiptAuditDirection | "all">("all");
  const [actorOpenId, setActorOpenId] = useState("");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<"all" | "verified">("all");
  const [qrStatus, setQrStatus] = useState<"all" | "active" | "expired" | "revoked" | "invalid">("all");
  const [receiptFormat, setReceiptFormat] = useState<"all" | "csv" | "pdf">("all");
  const [latestArtifact, setLatestArtifact] = useState<(GovernanceAuditIntegrityArtifact & { generatedAt: Date | string; timezone: "Asia/Jakarta"; scope: string; recordCount: number; byteSize: number; sha256: string }) | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<"unknown" | "verified" | "failed">("unknown");
  const input = useMemo(() => ({
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(datePreset === "all" ? {} : { datePreset }),
    ...(searchTerm.trim() ? { searchTerm: searchTerm.trim() } : {}),
    ...(direction === "all" ? {} : { direction }),
    ...(actorOpenId.trim() ? { actorOpenId: actorOpenId.trim() } : {}),
    ...(verificationStatusFilter === "all" ? {} : { verificationStatus: verificationStatusFilter }),
    ...(qrStatus === "all" ? {} : { qrStatus }),
    ...(receiptFormat === "all" ? {} : { receiptFormat }),
    scope: "governance_audit_qr_policy_receipt" as const,
  }), [actorOpenId, datePreset, direction, endDate, qrStatus, receiptFormat, searchTerm, startDate, verificationStatusFilter]);
  const auditQuery = trpc.reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport.useQuery(input, { enabled, retry: false, refetchOnWindowFocus: false });
  const exportMutation = trpc.reports.generateMonthlyArtifactGovernanceAuditQrPolicyReceiptExport.useMutation();
  const verifyMutation = trpc.reports.verifyMonthlyArtifactGovernanceAuditQrPolicyReceiptExport.useMutation();
  if (!enabled) return null;
  const audit = auditQuery.data;
  const activeFilterLabel = [searchTerm.trim() ? `Cari: ${searchTerm.trim()}` : "", direction === "all" ? "" : `Arah: ${direction}`, actorOpenId.trim() ? `Aktor: ${actorOpenId.trim()}` : "", verificationStatusFilter === "all" ? "" : `Receipt: ${verificationStatusFilter}`, qrStatus === "all" ? "" : `QR: ${qrStatus}`, receiptFormat === "all" ? "" : `Format: ${receiptFormat.toUpperCase()}`].filter(Boolean).join(" · ") || "Tidak ada";
  const verify = (artifact = latestArtifact) => {
    if (!artifact) return;
    setVerificationMessage(null);
    verifyMutation.mutate({ exportId: artifact.exportId, bytesBase64: artifact.bytesBase64 }, {
      onSuccess: (result) => {
        setVerificationState(result.verified ? "verified" : "failed");
        setVerificationMessage(result.verified ? `Terverifikasi server · ${result.byteSize} byte · SHA-256 cocok.` : "HASH TIDAK COCOK · byte yang diberikan berbeda dari ekspor server.");
      },
      onError: () => {
        setVerificationState("failed");
        setVerificationMessage("Verifikasi server gagal. Byte ekspor tidak diterima sebagai artefak valid.");
      },
    });
  };
  const generate = (format: "csv" | "pdf") => {
    setVerificationMessage(null);
    exportMutation.mutate({ ...input, format }, {
      onSuccess: (artifact) => {
        setLatestArtifact(artifact);
        setVerificationState("unknown");
        downloadGovernanceAuditIntegrityArtifact(artifact);
        verify(artifact);
      },
      onError: () => setVerificationMessage("Ekspor gabungan policy dan receipt QR tidak dapat dibuat. Pastikan filter dan akses owner-admin valid."),
    });
  };
  return <section className="governance-qr-policy-audit governance-qr-policy-receipt-audit" aria-label="Ekspor Gabungan Policy & Receipt">
    <div className="governance-section-heading"><FileText size={16} /><div><strong>Ekspor Gabungan Policy &amp; Receipt QR</strong><small>Korelasi read-only dari snapshot policy yang sudah tersimpan pada receipt dan riwayat append-only. Batas tanggal diproses server-side di Jakarta/WIB.</small></div></div>
    <div className="governance-qr-policy-audit-filters">
      <GovernanceAuditDateSearchFields ariaPrefix="audit gabungan QR" datePreset={datePreset} startDate={startDate} endDate={endDate} searchTerm={searchTerm} onDatePresetChange={setDatePreset} onStartDateChange={(value) => { setDatePreset("all"); setStartDate(value); }} onEndDateChange={(value) => { setDatePreset("all"); setEndDate(value); }} onSearchTermChange={setSearchTerm} onClear={() => { setDatePreset("all"); setStartDate(""); setEndDate(""); setSearchTerm(""); setDirection("all"); setActorOpenId(""); setVerificationStatusFilter("all"); setQrStatus("all"); setReceiptFormat("all"); }} />
      <label className="field"><span>Arah policy</span><select className="form-input" aria-label="Arah audit gabungan QR" value={direction} onChange={(event) => setDirection(event.target.value as QrPolicyReceiptAuditDirection | "all")}><option value="all">Semua arah</option><option value="initial">Initial</option><option value="increase">Meningkat</option><option value="decrease">Menurun</option><option value="unchanged">Tidak berubah</option></select></label>
      <label className="field"><span>Aktor policy</span><input className="form-input" aria-label="Aktor audit gabungan QR" maxLength={64} value={actorOpenId} placeholder="Semua aktor" onChange={(event) => setActorOpenId(event.target.value)} /></label>
      <label className="field"><span>Status receipt</span><select className="form-input" aria-label="Status receipt audit gabungan QR" value={verificationStatusFilter} onChange={(event) => setVerificationStatusFilter(event.target.value as "all" | "verified")}><option value="all">Semua status</option><option value="verified">Terverifikasi</option></select></label>
      <label className="field"><span>Status QR</span><select className="form-input" aria-label="Status QR audit gabungan" value={qrStatus} onChange={(event) => setQrStatus(event.target.value as "all" | "active" | "expired" | "revoked" | "invalid")}><option value="all">Semua status QR</option><option value="active">Aktif</option><option value="expired">Kedaluwarsa</option><option value="revoked">Dicabut</option><option value="invalid">Tidak valid</option></select></label>
      <label className="field"><span>Format receipt</span><select className="form-input" aria-label="Format receipt audit gabungan QR" value={receiptFormat} onChange={(event) => setReceiptFormat(event.target.value as "all" | "csv" | "pdf")}><option value="all">Semua format</option><option value="csv">CSV</option><option value="pdf">PDF</option></select></label>
    </div>
    {reviewPreset && <div className="report-review-apply"><small>Preset review Reports tersedia: <strong>{reportReviewPresetOptions.find((option) => option.value === reviewPreset)?.label}</strong>. Filter audit yang ada tidak akan berubah sebelum diterapkan.</small><button type="button" className="button ghost compact-button" onClick={() => { setDatePreset(reviewPreset); setStartDate(""); setEndDate(""); }}>Gunakan periode review</button></div>}
    {auditQuery.isLoading ? <div className="loading-state compact-loading"><span className="loading-dot" /> Memuat korelasi policy dan receipt…</div> : auditQuery.isError ? <p role="alert" className="integrity-error">Audit gabungan QR tidak tersedia, metadata receipt gagal uji integritas, atau akses owner-admin ditolak.</p> : audit ? <>
      <div className="governance-qr-policy-audit-summary"><div><span>Receipt tersaring</span><strong>{number(audit.recordCount)} record</strong><small>Scope: governance_audit_qr_policy_receipt</small></div><div><span>Rentang efektif</span><strong>{audit.filters.datePresetLabel ?? "Manual"}</strong><small>{audit.filters.startWib ?? "Tidak dibatasi"} s.d. {audit.filters.endWib ?? "Tidak dibatasi"}</small></div><div><span>Filter aktif</span><strong>{activeFilterLabel}</strong><small>Dicocokkan server-side</small></div><div><span>Bukti receipt</span><strong>Indeks owner persisten</strong><small>Tahan restart · tanpa byte receipt</small></div><div><span>Dibuat pada</span><strong>{wibTime(audit.generatedAt)}</strong><small>{audit.filters.dateBoundary.replaceAll("_", " ")}</small></div><div className="governance-audit-actions"><button type="button" className="button secondary compact-button" onClick={() => generate("csv")} disabled={exportMutation.isPending}><Download size={14} /> {exportMutation.isPending ? "Menyiapkan" : "CSV Gabungan"}</button><button type="button" className="button ghost compact-button" onClick={() => generate("pdf")} disabled={exportMutation.isPending}><FileText size={14} /> PDF Gabungan</button></div></div>
      {audit.recordCount === 0 ? <div className="governance-qr-policy-history-empty"><History size={15} /><span>Tidak ada receipt persisted yang sesuai dengan filter saat ini. Receipt yang tidak tersedia atau gagal dimuat tidak diperlakukan sebagai record valid; ekspor snapshot kosong tetap dapat dibuat dan diverifikasi.</span></div> : <ol className="governance-qr-policy-history-list governance-qr-policy-audit-list">{audit.records.slice(0, 5).map((record) => <li key={record.correlationId}><div><strong>{record.policyPreviousValidityMinutes ?? "Initial"} → {record.policyValidityMinutes} menit · {record.policyDirection}</strong><small>{wibTime(record.receiptIssuedAt)} · {record.receiptFormat.toUpperCase()} · {record.receiptVerificationStatus} · Status QR: {record.qrStatus} · Bukti: tersimpan · {record.policyCorrelation === "initial_policy" ? "Initial policy — no previous policy." : `${record.policyEventId ?? "—"} · ${record.policyChangedAt ? `berubah ${wibTime(record.policyChangedAt)}` : `oleh ${record.policyActorOpenId ?? "—"}`}`}</small></div><code title={record.correlationId}>{record.receiptId}</code></li>)}</ol>}
      {latestArtifact && <div className="governance-export-integrity" aria-label="Integritas ekspor gabungan policy dan receipt QR"><div className="governance-section-heading"><ShieldCheck size={16} /><strong>Integritas ekspor gabungan terbaru</strong><span className="badge success">Server-hashed</span></div><div className="governance-export-integrity-grid"><div><span>Format · ukuran</span><strong>{latestArtifact.format.toUpperCase()} · {fileSize(latestArtifact.byteSize)}</strong></div><div><span>Dibuat pada</span><strong>{wibTime(latestArtifact.generatedAt)}</strong></div><div className="integrity-scope"><span>Scope</span><strong>{latestArtifact.scope}</strong></div></div><div className="integrity-hash-row"><label htmlFor="qr-policy-receipt-audit-export-hash">SHA-256</label><input id="qr-policy-receipt-audit-export-hash" readOnly value={latestArtifact.sha256} aria-label="SHA-256 ekspor gabungan policy dan receipt QR" /><button type="button" className="button ghost compact-button" onClick={() => void navigator.clipboard.writeText(latestArtifact.sha256).catch(() => undefined)}><Copy size={13} /> Salin</button></div><div className="integrity-verification-row"><button type="button" className="button secondary compact-button" onClick={() => verify()} disabled={verifyMutation.isPending}><RefreshCw size={13} /> {verifyMutation.isPending ? "Memverifikasi" : "Verifikasi ulang"}</button><small>Id: {latestArtifact.exportId}</small>{verificationMessage && <span role="status" className={verificationState === "verified" ? "integrity-success" : "integrity-error"}>{verificationMessage}</span>}</div></div>}
    </> : null}
  </section>;
}

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

function GovernanceAuditExportPanel({ enabled, initialYear, reviewPreset }: { enabled: boolean; initialYear: number; reviewPreset: ReportReviewPreset | null }) {
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
  const qrRevocationMutation = trpc.reports.revokeMonthlyArtifactGovernanceAuditVerificationQr.useMutation();
  const qrExpiryPolicyQuery = trpc.reports.getMonthlyArtifactGovernanceAuditQrExpiryPolicy.useQuery(undefined, { enabled, retry: false, refetchOnWindowFocus: false });
  const qrExpiryPolicyMutation = trpc.reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy.useMutation();
  const qrExpiryPolicyHistoryQuery = trpc.reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory.useQuery(undefined, { enabled, retry: false, refetchOnWindowFocus: false });
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
  const [qrExpiryMinutes, setQrExpiryMinutes] = useState(30);
  const [qrExpiryPolicyHydrated, setQrExpiryPolicyHydrated] = useState(false);
  const [qrExpiryMessage, setQrExpiryMessage] = useState<string | null>(null);
  const [isQrRevokeConfirmOpen, setIsQrRevokeConfirmOpen] = useState(false);
  const [qrRevokeReason, setQrRevokeReason] = useState("");
  const [qrRevokeMessage, setQrRevokeMessage] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<{
    receiptId: string;
    qr: { referenceId: string; verificationUrl: string; imageDataUrl: string; issuedAt: Date | string; expiresAt: Date | string; verificationStatus: "verified" };
    policy: { validityMinutes: number; previousValidityMinutes: number | null; change: "initial" | "increase" | "decrease" | "unchanged"; differenceMinutes: number; policyEventId: string | null; issuedAt: Date | string; expiresAt: Date | string };
  } | null>(null);
  const qrRevocationInput = useMemo(() => ({ referenceId: latestReceipt?.qr.referenceId ?? `qr_${"0".repeat(32)}` }), [latestReceipt?.qr.referenceId]);
  const qrRevocationQuery = trpc.reports.getMonthlyArtifactGovernanceAuditQrRevocation.useQuery(qrRevocationInput, {
    enabled: enabled && Boolean(latestReceipt),
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!qrExpiryPolicyHydrated && qrExpiryPolicyQuery.data) {
      setQrExpiryMinutes(qrExpiryPolicyQuery.data.validityMinutes);
      setQrExpiryPolicyHydrated(true);
    }
  }, [qrExpiryPolicyHydrated, qrExpiryPolicyQuery.data]);
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
        setIsQrRevokeConfirmOpen(false);
        setQrRevokeMessage(null);
        setQrRevokeReason("");
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
        setIsQrRevokeConfirmOpen(false);
        setQrRevokeMessage(null);
        setQrRevokeReason("");
        const policy = result.receipt.policy;
        const policyChange = policy.change === "initial" ? "Initial policy" : policy.change === "increase" ? `naik ${policy.differenceMinutes} menit` : policy.change === "decrease" ? `turun ${Math.abs(policy.differenceMinutes)} menit` : "tidak berubah";
        const priorPolicy = policy.previousValidityMinutes === null ? "tanpa kebijakan sebelumnya" : `sebelumnya ${policy.previousValidityMinutes} menit`;
        setReceiptMessage(`Bukti verifikasi ${result.receipt.receiptFormat.toUpperCase()} diunduh · ${fileSize(result.receipt.receiptByteSize)} · SHA-256 ${result.receipt.receiptSha256.slice(0, 12)}… · Kebijakan QR ${policy.validityMinutes} menit (${policyChange}; ${priorPolicy}).`);
      },
      onError: () => setReceiptMessage("Bukti verifikasi tidak dapat diterbitkan. Tidak ada ekspor atau lifecycle yang diubah."),
    });
  };
  const saveQrExpiryPolicy = () => {
    setQrExpiryMessage(null);
    qrExpiryPolicyMutation.mutate({ validityMinutes: qrExpiryMinutes }, {
      onSuccess: async (policy) => {
        setQrExpiryMinutes(policy.validityMinutes);
        setQrExpiryPolicyHydrated(true);
        setQrExpiryMessage(policy.outcome === "unchanged" ? `Masa berlaku QR tetap ${policy.validityMinutes} menit. Tidak ada event riwayat baru karena konfigurasi efektif tidak berubah.` : `Masa berlaku QR baru disimpan: ${policy.validityMinutes} menit. Hanya QR yang diterbitkan setelah perubahan ini yang menggunakan durasi baru.`);
        await qrExpiryPolicyQuery.refetch();
        await qrExpiryPolicyHistoryQuery.refetch();
      },
      onError: () => setQrExpiryMessage("Masa berlaku QR harus berupa bilangan bulat antara 5 menit dan 7 hari. Tidak ada QR yang diubah."),
    });
  };
  const revokeLatestQr = () => {
    if (!latestReceipt) return;
    setQrRevokeMessage(null);
    qrRevocationMutation.mutate({
      referenceId: latestReceipt.qr.referenceId,
      exportId: latestExport?.exportId ?? "",
      receiptId: latestReceipt.receiptId,
      ...(qrRevokeReason === "" ? {} : { reason: qrRevokeReason }),
    }, {
      onSuccess: async (result) => {
        setQrRevokeMessage(result.outcome === "revoked" ? "Referensi QR dicabut. QR ini tidak akan lagi lolos verifikasi." : result.outcome === "already_revoked" ? "Referensi QR sudah dicabut sebelumnya." : result.message);
        setIsQrRevokeConfirmOpen(false);
        await qrRevocationQuery.refetch();
      },
      onError: () => setQrRevokeMessage("Pencabutan QR ditolak. Pastikan referensi masih berada dalam scope owner-admin."),
    });
  };
  const qrRevocation = qrRevocationQuery.data;
  const qrCanBeRevoked = Boolean(latestReceipt && !qrRevocation && new Date(latestReceipt.qr.expiresAt).getTime() > Date.now());
  return <Panel className="governance-audit-export-panel" title="Ekspor Audit Governance" description="Ekspor read-only jejak lifecycle yang sudah tersimpan. Filter diproses di server dalam scope owner-admin dan tidak mencatat event lifecycle baru.">
    <div className="governance-audit-stack">
      <QrExpiryPolicyHistory history={qrExpiryPolicyHistoryQuery.data} isLoading={qrExpiryPolicyHistoryQuery.isLoading} isError={qrExpiryPolicyHistoryQuery.isError} currentValidityMinutes={qrExpiryPolicyQuery.data?.validityMinutes ?? 30} />
      <GovernanceAuditQrPolicyExportPanel enabled={enabled} reviewPreset={reviewPreset} />
      <GovernanceAuditQrPolicyReceiptExportPanel enabled={enabled} reviewPreset={reviewPreset} />
      <div className="governance-audit-filters" aria-label="Filter ekspor audit governance">
        <label className="field"><span>Tahun periode</span><select aria-label="Tahun audit governance" className="form-input" value={auditYear} onChange={(event) => setAuditYear(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua tahun</option>{Array.from({ length: 8 }, (_, index) => initialYear - 5 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Bulan periode</span><select aria-label="Bulan audit governance" className="form-input" value={auditMonth} onChange={(event) => setAuditMonth(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua bulan</option>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
        <label className="field"><span>Lifecycle event</span><select aria-label="Lifecycle audit governance" className="form-input" value={auditLifecycle} onChange={(event) => setAuditLifecycle(event.target.value as LifecycleStatus | "all")}><option value="all">Semua lifecycle</option>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Format snapshot</span><select aria-label="Format audit governance" className="form-input" value={auditFormat} onChange={(event) => setAuditFormat(event.target.value as "csv" | "html" | "pdf" | "all")}><option value="all">Semua format</option><option value="csv">CSV</option><option value="pdf">PDF</option><option value="html">HTML</option></select></label>
        <label className="field"><span>Status artefak</span><select aria-label="Status artefak audit governance" className="form-input" value={auditScope} onChange={(event) => setAuditScope(event.target.value as "active" | "archived_or_retired" | "all")}><option value="all">Aktif, archived, dan retired</option><option value="active">Aktif saja</option><option value="archived_or_retired">Archived / retired</option></select></label>
      </div>
      {auditQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Menyiapkan audit governance…</div> : auditQuery.isError ? <ErrorState message="Ekspor audit governance tidak tersedia atau akses owner-admin ditolak." /> : audit ? <>
        <div className="governance-audit-summary"><div><span>Audit lifecycle</span><strong>{number(audit.recordCount)} record</strong><small>{governanceAuditFilterScope(audit)}</small></div><div><span>Dibuat pada</span><strong>{wibTime(audit.generatedAt)}</strong><small>Scope dan bytes ekspor dihitung server-side · {audit.timezone}</small></div><div className="governance-audit-actions"><button type="button" className="button secondary compact-button" onClick={() => generateAndDownload("csv")} disabled={exportMutation.isPending}><Download size={14} /> {exportMutation.isPending ? "Menyiapkan" : "CSV Audit"}</button><button type="button" className="button ghost compact-button" onClick={() => generateAndDownload("pdf")} disabled={exportMutation.isPending}><FileText size={14} /> PDF Audit</button></div></div>
        {latestExport && <div className="governance-export-integrity" aria-label="Integritas ekspor audit governance"><div className="governance-section-heading"><ShieldCheck size={16} /><strong>Integritas ekspor terbaru</strong><span className="badge success">Server-hashed</span></div><div className="governance-export-integrity-grid"><div><span>Format · ukuran</span><strong>{latestExport.format.toUpperCase()} · {fileSize(latestExport.byteSize)}</strong></div><div><span>Dibuat pada</span><strong>{wibTime(latestExport.generatedAt)}</strong></div><div className="integrity-scope"><span>Scope</span><strong>{latestExport.scope}</strong></div></div><div className="integrity-hash-row"><label htmlFor="governance-export-hash">SHA-256</label><input id="governance-export-hash" readOnly value={latestExport.sha256} aria-label="SHA-256 ekspor audit governance" /><button type="button" className="button ghost compact-button" onClick={() => void copyHash()}><Copy size={13} /> Salin</button></div><div className="integrity-verification-row"><button type="button" className="button secondary compact-button" onClick={() => verifyLatestExport()} disabled={verifyMutation.isPending}><RefreshCw size={13} /> {verifyMutation.isPending ? "Memverifikasi" : "Verifikasi ulang"}</button><small>Id: {latestExport.exportId}</small>{copyMessage && <span className="integrity-success">{copyMessage}</span>}{integrityMessage && <span role="status" className={verificationStatus === "verified" ? "integrity-success" : "integrity-error"}>{integrityMessage}</span>}</div><section className="governance-qr-expiry-policy" aria-label="Pengaturan masa berlaku QR"><div><strong>Masa berlaku QR baru</strong><small>Default 30 menit. Batas aman 5 menit–7 hari. Perubahan hanya berlaku untuk QR yang diterbitkan setelah disimpan.</small></div><label className="field"><span>Menit</span><input className="form-input" aria-label="Masa berlaku QR dalam menit" type="number" min={5} max={10080} step={1} value={qrExpiryMinutes} onChange={(event) => setQrExpiryMinutes(Number(event.target.value))} /></label><button type="button" className="button secondary compact-button" onClick={saveQrExpiryPolicy} disabled={qrExpiryPolicyMutation.isPending || qrExpiryPolicyQuery.isLoading}><Clock3 size={13} /> {qrExpiryPolicyMutation.isPending ? "Menyimpan" : "Simpan durasi"}</button>{qrExpiryMessage && <span role={qrExpiryPolicyMutation.isError ? "alert" : "status"} className={qrExpiryPolicyMutation.isError ? "integrity-error" : "integrity-success"}>{qrExpiryMessage}</span>}</section><div className="verification-receipt-actions" aria-label="Bukti verifikasi ekspor audit"><div><strong>Bukti verifikasi</strong><small>Hanya diterbitkan setelah byte ekspor ini berhasil diverifikasi server-side.</small></div><div><button type="button" className="button secondary compact-button" onClick={() => downloadReceipt("csv")} disabled={verificationStatus !== "verified" || receiptMutation.isPending}><Download size={13} /> {receiptMutation.isPending ? "Menerbitkan" : "Bukti CSV"}</button><button type="button" className="button ghost compact-button" onClick={() => downloadReceipt("pdf")} disabled={verificationStatus !== "verified" || receiptMutation.isPending}><FileText size={13} /> Bukti PDF</button></div>{receiptMessage && <span role={receiptMessage.startsWith("Bukti verifikasi") ? "status" : "alert"} className={receiptMessage.startsWith("Bukti verifikasi") ? "integrity-success" : "integrity-error"}>{receiptMessage}</span>}</div>{latestReceipt && <section className="governance-qr-reference" aria-label="Referensi QR verifikasi audit"><img src={latestReceipt.qr.imageDataUrl} alt="QR untuk referensi verifikasi audit" /><div><strong>Referensi QR terverifikasi</strong><p>QR hanya memuat referensi aman, ID ekspor, ID bukti, dan status terverifikasi. QR tidak membuka unduhan artefak.</p><code>{latestReceipt.qr.referenceId}</code><small>Diterbitkan {wibTime(latestReceipt.qr.issuedAt)} · Berlaku sampai {wibTime(latestReceipt.qr.expiresAt)}.</small><a className="button ghost compact-button" href={latestReceipt.qr.verificationUrl}>Buka hasil verifikasi QR</a>{qrRevocation ? <div className="governance-qr-revoked" role="status"><strong>QR dicabut</strong><small>Dicabut {wibTime(qrRevocation.revokedAt)} oleh {qrRevocation.actorOpenId}. Verifikasi QR ini selalu ditolak.</small>{qrRevocation.reason !== null && <small>Alasan: {qrRevocation.reason}</small>}</div> : <>{qrCanBeRevoked && <button type="button" className="button danger compact-button" onClick={() => setIsQrRevokeConfirmOpen(true)} disabled={qrRevocationMutation.isPending}>Cabut QR</button>}{!qrCanBeRevoked && <small className="governance-qr-inactive">QR tidak lagi aktif untuk dicabut dari panel ini.</small>}{isQrRevokeConfirmOpen && <section className="governance-qr-revoke-confirmation" aria-label="Konfirmasi pencabutan QR"><div><strong>Cabut referensi QR?</strong><p>Periode {months[jakartaYearMonth(latestExport.generatedAt).month - 1]} {jakartaYearMonth(latestExport.generatedAt).year} · ekspor {latestExport.exportId} · referensi {latestReceipt.qr.referenceId}.</p><p>Diterbitkan {wibTime(latestReceipt.qr.issuedAt)} · berakhir {wibTime(latestReceipt.qr.expiresAt)} · status saat ini aktif.</p></div><div className="archive-confirmation-notice"><AlertTriangle size={17} /><p>Referensi QR tidak akan lagi lolos verifikasi. Artefak, lifecycle, retensi, dan receipt tidak diubah.</p></div><label className="field"><span>Alasan opsional (maks. 500 karakter)</span><textarea className="form-input" aria-label="Alasan pencabutan QR" maxLength={500} value={qrRevokeReason} onChange={(event) => setQrRevokeReason(event.target.value)} /></label><div className="governance-qr-revoke-actions"><button type="button" className="button ghost compact-button" onClick={() => setIsQrRevokeConfirmOpen(false)} disabled={qrRevocationMutation.isPending}>Batal</button><button type="button" className="button danger compact-button" onClick={revokeLatestQr} disabled={qrRevocationMutation.isPending}>{qrRevocationMutation.isPending ? "Mencabut" : "Konfirmasi cabut QR"}</button></div></section>}</>}{qrRevokeMessage && <span role={qrRevocationMutation.isError ? "alert" : "status"} className={qrRevocationMutation.isError ? "integrity-error" : "integrity-success"}>{qrRevokeMessage}</span>}</div></section>}</div>}
        {audit.records.length ? <div className="governance-audit-preview" aria-label="Pratinjau audit lifecycle"><div className="governance-section-heading"><History size={16} /><strong>Pratinjau event lifecycle</strong><small>{audit.recordCount} record sesuai filter</small></div><ul>{audit.records.map((record, index) => <li key={`${record.reportPeriod.year}-${record.reportPeriod.month}-${record.lifecycleStatus}-${record.occurredAt}-${record.artifactFormat}-${index}`}><div><strong>{months[record.reportPeriod.month - 1]} {record.reportPeriod.year}</strong><span className={`badge ${lifecycleClass[record.lifecycleStatus]}`}>{lifecycleLabel[record.lifecycleStatus]}</span><small>{wibTime(record.occurredAt)} · {record.source} · {record.actor}</small></div><div><span className="badge neutral">{record.artifactScope}</span><small>{record.artifactFormat.toUpperCase()} · {record.bytes === null ? "Snapshot tidak tersedia" : `${fileSize(record.bytes)} · SHA-256 ${record.sha256?.slice(0, 12)}…`}</small></div></li>)}</ul>{audit.recordCount > 5 && <p className="settings-help"><History size={14} /> Pratinjau menampilkan 5 event terbaru; CSV dan cetak memuat seluruh {audit.recordCount} record terfilter.</p>}</div> : <div className="empty-state artifact-empty"><div className="empty-icon"><History size={20} /></div><strong>Tidak ada event lifecycle untuk filter ini.</strong><p>CSV audit tetap dapat diunduh sebagai bukti filter, metadata, dan hasil kosong tanpa mengubah lifecycle artefak.</p></div>}
      </> : null}
      {latestReceipt?.policy && <GovernanceAuditQrReceiptPolicy policy={latestReceipt.policy} />}
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
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlReviewState = useMemo(() => parseReportReviewUrlState(search, initial), [initial, search]);
  const [year, setYear] = useState(urlReviewState.year);
  const [month, setMonth] = useState(urlReviewState.month);
  const [reviewPreset, setReviewPreset] = useState<ReportReviewPreset | null>(urlReviewState.preset);
  const [artifactYear, setArtifactYear] = useState(initial.year);
  const [artifactMonth, setArtifactMonth] = useState<number | "all">("all");
  const [historyPeriod, setHistoryPeriod] = useState<{ year: number; month: number } | null>(null);
  const [archivePeriod, setArchivePeriod] = useState<{ year: number; month: number; lifecycleStatus: LifecycleStatus; generatedAt: Date | string } | null>(null);
  const auth = useAuth();
  const isOwnerAdmin = auth.isAuthenticated && auth.user?.role === "admin";
  const reviewRangeQuery = trpc.reports.monthlyArtifactGovernanceAuditQrPolicyExport.useQuery(
    reviewPreset ? { datePreset: reviewPreset, scope: "governance_audit_qr_expiry" as const } : undefined,
    { enabled: isOwnerAdmin && Boolean(reviewPreset), retry: false, refetchOnWindowFocus: false },
  );
  useEffect(() => {
    setYear(urlReviewState.year);
    setMonth(urlReviewState.month);
    setReviewPreset(urlReviewState.preset);
  }, [urlReviewState]);
  const query = trpc.reports.monthlySummary.useQuery({ year, month });
  const report = query.data;
  const artifactListFilter = urlReviewState.artifactList;
  const artifactListInput = useMemo(() => {
    if (!artifactListFilter.active) return { year: artifactYear, ...(artifactMonth === "all" ? {} : { month: artifactMonth }) };
    if (reviewPreset) return {
      datePreset: reviewPreset,
      ...(artifactListFilter.format ? { format: artifactListFilter.format } : {}),
      ...(artifactListFilter.integrity ? { integrity: artifactListFilter.integrity } : {}),
      ...(artifactListFilter.retentionStatus ? { retentionStatus: artifactListFilter.retentionStatus } : {}),
    };
    if (!report) return null;
    return {
      startDate: report.period.startDate,
      endDate: report.period.endDate,
      ...(artifactListFilter.format ? { format: artifactListFilter.format } : {}),
      ...(artifactListFilter.integrity ? { integrity: artifactListFilter.integrity } : {}),
      ...(artifactListFilter.retentionStatus ? { retentionStatus: artifactListFilter.retentionStatus } : {}),
    };
  }, [artifactListFilter, artifactMonth, artifactYear, report, reviewPreset]);
  const artifactsQuery = trpc.reports.monthlyArtifacts.useQuery(
    artifactListInput ?? { year: 2000 },
    { enabled: isOwnerAdmin && Boolean(artifactListInput), retry: false, refetchOnWindowFocus: false },
  );
  const activeArtifactSummaryInput = useMemo(() => reviewPreset
    ? { datePreset: reviewPreset }
    : report ? { startDate: report.period.startDate, endDate: report.period.endDate } : null,
  [report, reviewPreset]);
  const activeArtifactSummaryQuery = trpc.reports.monthlyActiveArtifactSummary.useQuery(
    activeArtifactSummaryInput ?? { startDate: "2000-01-01", endDate: "2000-01-01" },
    { enabled: isOwnerAdmin && Boolean(activeArtifactSummaryInput), retry: false, refetchOnWindowFocus: false },
  );
  const reviewOption = reviewPreset ? reportReviewPresetOptions.find((option) => option.value === reviewPreset) : null;
  const reviewRange = reviewRangeQuery.data?.filters;
  const updateReviewState = (next: { preset: ReportReviewPreset | null; year: number; month: number; artifactList?: typeof artifactListFilter }) => {
    const state = { ...next, artifactList: next.artifactList ?? artifactListFilter };
    setReviewPreset(state.preset);
    setYear(state.year);
    setMonth(state.month);
    navigate(getReportReviewPath(state, initial));
  };
  const selectReviewPreset = (value: ReportReviewPreset | "custom") => {
    if (value === "custom") {
      updateReviewState({ preset: null, year, month });
      return;
    }
    const focused = getFocusedMonthForReportReviewPreset(value, initial);
    updateReviewState({ preset: value, year: focused.year, month: focused.month });
  };
  const updateManualYear = (nextYear: number) => updateReviewState({ preset: null, year: nextYear, month });
  const updateManualMonth = (nextMonth: number) => updateReviewState({ preset: null, year, month: nextMonth });
  const downloadCsv = () => { if (report) downloadMonthlyReportCsv(report); };
  const activeArtifactSummary = activeArtifactSummaryQuery.data;
  const activeArtifactScopeLabel = reviewOption?.label ?? report?.period.label ?? `${months[month - 1]} ${year}`;
  const openActiveArtifactList = (filter: { format?: ReportArtifactListFormat; integrity?: "healthy"; retentionStatus?: ReportArtifactRetentionStatus }) => {
    if (!activeArtifactSummary || activeArtifactSummary.activeArtifactCount === 0) return;
    updateReviewState({ preset: reviewPreset, year, month, artifactList: { active: true, format: filter.format ?? null, integrity: filter.integrity ?? null, retentionStatus: filter.retentionStatus ?? null } });
    window.setTimeout(() => document.getElementById("stored-artifact-list")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const updateArtifactRetentionFilter = (retentionStatus: ReportArtifactRetentionStatus | null) => updateReviewState({ preset: reviewPreset, year, month, artifactList: { ...artifactListFilter, active: true, retentionStatus } });
  const clearActiveArtifactListFilter = () => updateReviewState({ preset: reviewPreset, year, month, artifactList: { active: false, format: null, integrity: null, retentionStatus: null } });
  const visibleArtifactFormats: Array<"csv" | "pdf" | "html"> = artifactListFilter.active && artifactListFilter.format
    ? [artifactListFilter.format]
    : ["csv", "pdf", "html"];
  return <AppShell active="reports" eyebrow="Management Reporting" title="Monthly Summary">
    <PageHeader eyebrow="MONTHLY REPORTING" title="Ringkasan Manajemen Bulanan" description="Financial Core dan Inventory Intelligence dalam satu laporan read-only berbasis kalender Jakarta/WIB." action={<div className="header-actions"><button className="button secondary" onClick={downloadCsv} disabled={!report}><Download size={16} /> CSV</button><button className="button ghost" onClick={() => printMonthlyReport(report)} disabled={!report}><FileText size={16} /> PDF / Cetak</button></div>} />
    <Panel title="Periode laporan" description="Batas laporan memakai 00:00 WIB pada hari pertama sampai sebelum 00:00 WIB bulan berikutnya."><div className="form-grid report-period-controls"><label className="field"><span>Tahun</span><select className="form-input" value={year} onChange={(event) => updateManualYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => initial.year - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Bulan</span><select className="form-input" value={month} onChange={(event) => updateManualMonth(Number(event.target.value))}>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label><div className="report-period-label"><span>Bulan fokus laporan</span><strong>{report?.period.label ?? `${months[month - 1]} ${year}`}</strong><small>{report?.period.startDate ?? "—"} s/d {report?.period.endDate ?? "—"} · Asia/Jakarta</small></div></div><section className="report-review-context" aria-label="Periode review laporan"><div className="report-review-context-heading"><div><span className="eyebrow">KONTEKS READ-ONLY</span><h3>Periode review laporan</h3><p>Preset hanya memberi konteks peninjauan dan tidak menggabungkan perhitungan bulanan. Ringkasan di atas tetap untuk bulan fokus yang dipilih.</p></div><button type="button" className="button ghost compact-button" onClick={() => updateReviewState({ preset: null, year: initial.year, month: initial.month })} disabled={!reviewPreset && year === initial.year && month === initial.month}>Reset</button></div><div className="report-review-context-grid"><label className="field"><span>Preset review</span><select aria-label="Preset periode review laporan" className="form-input" value={reviewPreset ?? "custom"} onChange={(event) => selectReviewPreset(event.target.value as ReportReviewPreset | "custom")}><option value="custom">Kustom / bulan fokus</option>{reportReviewPresetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div><span>Status konteks</span><strong>{reviewOption ? reviewOption.label : "Kustom"}</strong><small>{reviewOption ? `Preset · ${reviewOption.periodCount} periode kalender` : "Pilihan tahun/bulan manual berwenang"}</small></div><div><span>Rentang efektif</span><strong>{reviewOption ? (reviewRangeQuery.isLoading ? "Memuat batas WIB…" : reviewRange?.datePresetLabel ?? "Belum tersedia") : `${months[month - 1]} ${year}`}</strong><small>{reviewOption ? (reviewRange ? `${reviewRange.startWib} sampai sebelum ${reviewRange.endWib}` : isOwnerAdmin ? "Rentang tidak tersedia." : "Rentang audit server-side tersedia untuk owner-admin.") : `${report?.period.startDate ?? "—"} sampai ${report?.period.endDate ?? "—"} · bulan fokus`}</small></div><div><span>Zona waktu & batas</span><strong>Asia/Jakarta (WIB)</strong><small>Mulai inklusif · akhir eksklusif</small></div></div>{reviewRangeQuery.isError && <p role="alert" className="integrity-error">Konteks range review tidak tersedia. Perhitungan laporan bulanan tidak diubah.</p>}</section></Panel>
    <Panel title="Ringkasan Artefak Aktif" description="Ringkasan read-only artefak laporan yang masih dapat diambil normal dalam scope periode review. Verifikasi checksum tetap dijalankan server-side.">
      {!auth.isAuthenticated ? <div className="artifact-access-state"><ShieldCheck size={22} /><div><strong>Masuk sebagai pemilik untuk melihat ringkasan artefak.</strong><p>Scope dan status integritas hanya tersedia melalui akses owner-admin server-side.</p></div><button className="button primary" onClick={() => startLogin()}>Masuk</button></div> : auth.user?.role !== "admin" ? <div className="artifact-access-state restricted"><AlertTriangle size={22} /><div><strong>Ringkasan artefak dibatasi.</strong><p>Akun ini tidak memiliki akses pemilik untuk metadata artefak Management Reports.</p></div></div> : activeArtifactSummaryQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memverifikasi artefak aktif untuk periode review…</div> : activeArtifactSummaryQuery.isError ? <ErrorState message="Ringkasan artefak aktif tidak tersedia atau akses Anda tidak diizinkan." /> : activeArtifactSummary ? <ActiveArtifactSummary summary={activeArtifactSummary} scopeLabel={activeArtifactScopeLabel} onOpenList={openActiveArtifactList} /> : null}
    </Panel>
    <RetentionSummaryExportPanel enabled={isOwnerAdmin} input={activeArtifactSummaryInput} activeArtifactCount={activeArtifactSummary ? activeArtifactSummary.activeArtifactCount : null} scopeLabel={activeArtifactScopeLabel} summaryState={activeArtifactSummaryQuery.isError ? "error" : activeArtifactSummaryQuery.isLoading && Boolean(activeArtifactSummaryInput) ? "loading" : "ready"} />
    {query.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat laporan bulanan…</div> : query.isError ? <ErrorState message="Laporan bulanan tidak dapat dimuat. Silakan coba lagi." /> : report ? <div className="monthly-report-grid"><Panel title="Financial Core" description="Nilai yang sudah mengikuti pembatalan, refund, dan exchange sesuai Financial Core."><div className="summary-grid"><Metric label="Gross Sales" value={currency(report.financial.grossSales)} /><Metric label="Net Revenue" value={currency(report.financial.netRevenue)} /><Metric label="COGS" value={currency(report.financial.cogs)} /><Metric label="Gross Profit" value={currency(report.financial.grossProfit)} /><Metric label="Gross Margin" value={`${number(report.financial.grossMargin)}%`} /><Metric label="Sales" value={number(report.financial.salesTransactionCount)} /><Metric label="Refund Value" value={currency(report.financial.refundValue)} /><Metric label="Void Value" value={currency(report.financial.voidValue)} /><Metric label="Exchange Impact" value={currency(report.financial.exchangeImpact)} /></div></Panel><Panel title="Inventory Intelligence" description="Rekonsiliasi memakai inventory ledger dan tolerance engine yang sudah ada."><div className="summary-grid"><Metric label="Opening Stock" value={number(report.inventory.openingStock)} /><Metric label="Expected Stock" value={number(report.inventory.expectedStock)} /><Metric label="Actual / Closing Stock" value={number(report.inventory.actualStock)} /><Metric label="Total Variance" value={number(report.inventory.totalVariance)} /><Metric label="Di luar toleransi" value={number(report.inventory.outOfToleranceItemCount)} /><Metric label="High-value variance" value={number(report.inventory.highValueVarianceCount)} /><Metric label="Varians tinggi berulang" value={number(report.inventory.recurringHighVarianceIngredientCount)} detail="2/3 atau 3/3 periode comparable" /><Metric label="Sesi stock-opname" value={number(report.inventory.stockOpnameSessionCount)} /><Metric label="Follow-up terbuka" value={number(report.inventory.openStockOpnameFollowUpCount)} /></div></Panel></div> : <Panel title="Tidak ada data" description="Belum ada data transaksi atau pergerakan untuk bulan Jakarta/WIB yang dipilih."><div className="empty-state">Belum ada data pada periode yang dipilih.</div></Panel>}
    {report && <Panel title="Metadata laporan" description="Metadata ini ikut tersedia pada CSV dan tampilan cetak/PDF."><div className="report-metadata"><div><span>Dibuat pada</span><strong>{report.generatedAt ? wibTime(report.generatedAt) : "—"}</strong></div><div><span>Catatan audit</span>{(report.auditNotes ?? []).length ? <ul>{(report.auditNotes ?? []).map((entry, index) => <li key={`${entry.reference}-${entry.type}-${index}`}><strong>{entry.reference}</strong> · {entry.note}</li>)}</ul> : <strong>Tidak ada catatan audit pada periode ini.</strong>}</div></div></Panel>}
    <Panel title="Artefak laporan tersimpan" description="CSV, PDF, dan HTML yang tersimpan untuk periode selesai. Akses dan unduhan hanya tersedia bagi pemilik StoreOS setelah checksum tervalidasi di server.">
      {!auth.isAuthenticated ? <div className="artifact-access-state"><ShieldCheck size={22} /><div><strong>Masuk sebagai pemilik untuk membuka arsip.</strong><p>Ringkasan bulanan tetap tersedia secara read-only. Artefak tersimpan memakai akses server-side yang dibatasi.</p></div><button className="button primary" onClick={() => startLogin()}>Masuk</button></div> : auth.user?.role !== "admin" ? <div className="artifact-access-state restricted"><AlertTriangle size={22} /><div><strong>Arsip laporan dibatasi.</strong><p>Akun ini tidak memiliki akses pemilik untuk artefak Management Reports.</p></div></div> : <>
        <div id="stored-artifact-list" className="stored-artifact-list-anchor">{artifactListFilter.active ? <div className="artifact-active-filter" aria-label="Filter artefak aktif"><div><span className="eyebrow">FILTER DARI RINGKASAN</span><strong>{activeArtifactScopeLabel}</strong><small>{artifactListFilter.format ? `Format ${artifactListFilter.format.toUpperCase()} · ` : "Semua format · "}{artifactListFilter.integrity === "healthy" ? "integritas sehat · " : "artefak aktif · "}{artifactListFilter.retentionStatus ? retentionStatusLabel[artifactListFilter.retentionStatus] : "semua status retensi"} · Asia/Jakarta (WIB)</small></div><button type="button" className="button ghost compact-button" onClick={clearActiveArtifactListFilter}>Kembali ke arsip laporan</button></div> : <div className="artifact-filter-row"><label className="field"><span>Tahun arsip</span><select aria-label="Tahun arsip" className="form-input" value={artifactYear} onChange={(event) => setArtifactYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => initial.year - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Bulan arsip</span><select aria-label="Bulan arsip" className="form-input" value={artifactMonth} onChange={(event) => setArtifactMonth(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">Semua bulan</option>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label></div>}</div>
        {artifactsQuery.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memverifikasi artefak tersimpan…</div> : artifactsQuery.isError ? <ErrorState message="Arsip laporan tidak dapat dimuat atau akses Anda tidak diizinkan." /> : artifactsQuery.data?.length ? <div className="artifact-table-wrap"><table className="artifact-table"><thead><tr><th>Periode</th><th>Dibuat (WIB)</th><th>Lifecycle</th><th>Retensi</th>{visibleArtifactFormats.map((format) => <th key={format}>{format.toUpperCase()}</th>)}<th>Kontrol</th></tr></thead><tbody>{artifactsQuery.data.map((artifact) => <tr key={artifact.id}><td><strong>{months[artifact.month - 1]} {artifact.year}</strong><small>{artifact.periodStartDate} s/d {artifact.periodEndDate}</small></td><td>{wibTime(artifact.generatedAt)}</td><td><span className={`badge ${lifecycleClass[artifact.lifecycleStatus as LifecycleStatus]}`}>{lifecycleLabel[artifact.lifecycleStatus as LifecycleStatus]}</span></td><td><span className={`badge ${retentionStatusClass[artifact.retention.status as ReportArtifactRetentionStatus]}`}>{retentionStatusLabel[artifact.retention.status as ReportArtifactRetentionStatus]}</span><small>Batas {wibTime(artifact.retention.archiveEligibleAt)}</small></td>{visibleArtifactFormats.map((format) => { const file = format === "html" ? artifact.printableHtml : artifact[format]; return <td key={format}><span className={`badge ${artifactStatusClass[file.status as IntegrityStatus]}`}>{artifactStatusLabel[file.status as IntegrityStatus]}</span><small>{fileSize(file.bytes)} · SHA-256</small></td>; })}<td><div className="artifact-download-actions">{visibleArtifactFormats.map((format) => <ArtifactDownload key={format} year={artifact.year} month={artifact.month} kind={format} status={(format === "html" ? artifact.printableHtml : artifact[format]).status as IntegrityStatus} />)}<button type="button" className="button ghost compact-button lifecycle-history-action" onClick={() => setHistoryPeriod({ year: artifact.year, month: artifact.month })}><History size={14} /> Riwayat Lifecycle</button>{artifact.lifecycleStatus === "eligible_for_archive" && <button type="button" className="button danger compact-button archive-action" onClick={() => setArchivePeriod({ year: artifact.year, month: artifact.month, lifecycleStatus: artifact.lifecycleStatus as LifecycleStatus, generatedAt: artifact.generatedAt })}><Archive size={14} /> Arsipkan</button>}</div></td></tr>)}</tbody></table></div> : <div className="empty-state artifact-empty"><div className="empty-icon"><Archive size={20} /></div><strong>Belum ada artefak tersimpan untuk filter ini.</strong><p>Artefak akan muncul setelah laporan bulanan periode selesai dibuat dan melewati verifikasi integritas.</p></div>}
        <LifecycleHistoryPanel selection={historyPeriod} onClose={() => setHistoryPeriod(null)} />
        <ArchiveConfirmationPanel selection={archivePeriod} onClose={() => setArchivePeriod(null)} />
      </>}
    </Panel>
    <GovernancePanel enabled={isOwnerAdmin} />
    <GovernanceAuditExportPanel enabled={isOwnerAdmin} initialYear={initial.year} reviewPreset={reviewPreset} />
    <p className="settings-help"><RefreshCw size={14} /> Laporan dan governance ini bersifat read-only serta tidak mengubah penjualan, ledger, stock-opname, atau Financial Core.</p>
  </AppShell>;
}
