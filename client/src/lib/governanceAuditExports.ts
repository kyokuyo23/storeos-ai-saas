export type GovernanceAuditLifecycleStatus = "generated" | "verified" | "retained" | "eligible_for_archive" | "archived";
export type GovernanceAuditArtifactFormat = "csv" | "html" | "pdf" | "bundle";

export type GovernanceAuditExportData = {
  kind: "storeos_governance_lifecycle_audit";
  version: 1;
  generatedAt: Date | string;
  timezone: "Asia/Jakarta";
  filters: {
    year: number | null;
    month: number | null;
    lifecycleStatus: GovernanceAuditLifecycleStatus | null;
    artifactFormat: Exclude<GovernanceAuditArtifactFormat, "bundle"> | null;
    artifactScope: "active" | "archived_or_retired" | null;
  };
  recordCount: number;
  records: Array<{
    reportPeriod: { year: number; month: number; timezone: string };
    lifecycleStatus: GovernanceAuditLifecycleStatus;
    occurredAt: Date | string;
    source: string;
    actor: string;
    transitionReason: string | null;
    eventArtifactFormat: string;
    artifactFormat: GovernanceAuditArtifactFormat;
    bytes: number | null;
    sha256: string | null;
    integritySnapshotStatus: "recorded" | "unavailable";
    artifactScope: "active" | "archived" | "retired";
    currentLifecycleStatus: GovernanceAuditLifecycleStatus;
    archiveEligibleAt: Date | string | null;
    archivedAt: Date | string | null;
    retiredAt: Date | string | null;
    archiveReason: string | null;
  }>;
};

const wibTime = (value: Date | string | null) => value ? `${new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : "";
const escapeCell = (cell: string | number | null | undefined) => `"${String(cell ?? "").replaceAll('"', '""')}"`;
const valueOrAll = <Value extends string | number>(value: Value | null) => value === null ? "Semua" : String(value);

export function governanceAuditFilterScope(audit: GovernanceAuditExportData): string {
  const filters = audit.filters;
  return [
    `periode=${filters.year === null ? "semua" : `${filters.year}-${filters.month === null ? "semua" : String(filters.month).padStart(2, "0")}`}`,
    `lifecycle=${filters.lifecycleStatus ?? "semua"}`,
    `format=${filters.artifactFormat ?? "semua"}`,
    `status artefak=${filters.artifactScope ?? "semua"}`,
  ].join("; ");
}

function rowsFor(audit: GovernanceAuditExportData): Array<Array<string | number | null>> {
  const columns = ["Tahun", "Bulan", "Timezone", "Lifecycle event", "Timestamp event (WIB)", "Sumber event", "Aktor / owner", "Format snapshot", "Format event", "Ukuran byte", "SHA-256 snapshot", "Status snapshot", "Status artefak", "Lifecycle saat ini", "Eligible sejak (WIB)", "Diarsipkan (WIB)", "Retired (WIB)", "Alasan arsip", "Metadata transisi"];
  const rows = [
    ["StoreOS Governance Lifecycle Audit Export", `v${audit.version}`],
    ["Jenis laporan", "Governance / Lifecycle Audit"],
    ["Generated At (Asia/Jakarta)", wibTime(audit.generatedAt)],
    ["Timezone", audit.timezone],
    ["Filter tahun", valueOrAll(audit.filters.year)],
    ["Filter bulan", valueOrAll(audit.filters.month)],
    ["Filter lifecycle", valueOrAll(audit.filters.lifecycleStatus)],
    ["Filter format", valueOrAll(audit.filters.artifactFormat)],
    ["Filter status artefak", valueOrAll(audit.filters.artifactScope)],
    ["Jumlah record", audit.recordCount],
    [],
    columns,
    ...audit.records.map((record) => [
      record.reportPeriod.year,
      record.reportPeriod.month,
      record.reportPeriod.timezone,
      record.lifecycleStatus,
      wibTime(record.occurredAt),
      record.source,
      record.actor,
      record.artifactFormat,
      record.eventArtifactFormat,
      record.bytes,
      record.sha256,
      record.integritySnapshotStatus,
      record.artifactScope,
      record.currentLifecycleStatus,
      wibTime(record.archiveEligibleAt),
      wibTime(record.archivedAt),
      wibTime(record.retiredAt),
      record.archiveReason,
      record.transitionReason,
    ]),
  ];
  return rows.map((row) => [...row, ...Array.from({ length: columns.length - row.length }, () => "")]);
}

export function buildGovernanceAuditCsv(audit: GovernanceAuditExportData): string {
  return `\uFEFF${rowsFor(audit).map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
}

export function governanceAuditCsvFilename(audit: GovernanceAuditExportData): string {
  const year = audit.filters.year ?? "all";
  const month = audit.filters.month === null ? "all" : String(audit.filters.month).padStart(2, "0");
  const lifecycle = audit.filters.lifecycleStatus ?? "all";
  const format = audit.filters.artifactFormat ?? "all";
  const scope = audit.filters.artifactScope ?? "all";
  return `storeos-governance-audit-${year}-${month}-${lifecycle}-${format}-${scope}.csv`;
}

export function downloadGovernanceAuditCsv(audit: GovernanceAuditExportData): void {
  const url = URL.createObjectURL(new Blob([buildGovernanceAuditCsv(audit)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = governanceAuditCsvFilename(audit);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printGovernanceAudit(audit: GovernanceAuditExportData | undefined): void {
  if (!audit) return;
  document.body.classList.add("printing-governance-audit");
  window.print();
  document.body.classList.remove("printing-governance-audit");
}
