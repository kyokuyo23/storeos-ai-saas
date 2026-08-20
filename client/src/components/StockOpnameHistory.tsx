import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleCheck, ClipboardList, Search, Siren, X } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import { filterOpnameSessionsByStatus, getOpnameHistorySessionReference, getOpnameHistoryStatusFilter, type OpnameHistoryStatusFilter } from "@/lib/opnameHistoryFilters";
import { getJakartaCalendarDayAge, getOpnameHistorySessionPriority } from "@/lib/opnameSessionAgePriority";
import "@/lib/opnameHistory.css";

const formatQuantity = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const formatDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
const followUpStatuses = {
  needs_follow_up: { label: "Perlu tindak lanjut", className: "needs-follow-up" },
  in_progress: { label: "Sedang ditindaklanjuti", className: "in-progress" },
  resolved: { label: "Selesai ditindaklanjuti", className: "resolved" },
  not_required: { label: "Tidak diperlukan", className: "not-required" },
} as const;

function Loading() { return <div className="loading-state"><span className="loading-dot" /> Memuat riwayat sesi…</div>; }

function SessionPriorityIcon({ tone }: { tone: "normal" | "warning" | "critical" | "resolved" | "not_required" }) {
  if (tone === "critical") return <Siren size={15} aria-hidden="true" />;
  if (tone === "warning") return <AlertTriangle size={15} aria-hidden="true" />;
  if (tone === "resolved") return <CheckCircle2 size={15} aria-hidden="true" />;
  return <CircleCheck size={15} aria-hidden="true" />;
}

export function StockOpnameHistory() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [referenceDraft, setReferenceDraft] = useState("");
  const [referenceFilter, setReferenceFilter] = useState("");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const queryInput = useMemo(() => referenceFilter ? { reference: referenceFilter } : undefined, [referenceFilter]);
  const sessionsQuery = trpc.stockMovement.opnameSessions.useQuery(queryInput);
  const settingsQuery = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const updateFollowUp = trpc.stockMovement.updateOpnameFollowUp.useMutation({ onSuccess: () => utils.stockMovement.opnameSessions.invalidate() });
  const updateFollowUpNote = trpc.stockMovement.updateOpnameFollowUpNote.useMutation({ onSuccess: () => utils.stockMovement.opnameSessions.invalidate() });
  const statusFilter = useMemo(() => getOpnameHistoryStatusFilter(search), [search]);
  const targetSessionReference = useMemo(() => getOpnameHistorySessionReference(search), [search]);
  const sessions = useMemo(() => filterOpnameSessionsByStatus(sessionsQuery.data ?? [], statusFilter), [sessionsQuery.data, statusFilter]);
  useEffect(() => {
    if (!targetSessionReference || !sessions.some((session) => session.reference === targetSessionReference)) return;
    setSelectedReference(targetSessionReference);
    const frame = window.requestAnimationFrame(() => document.getElementById(`opname-session-${targetSessionReference}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [targetSessionReference, sessions]);
  const submitFilter = (event: React.FormEvent) => { event.preventDefault(); setReferenceFilter(referenceDraft.trim()); setSelectedReference(null); };
  const resetFilter = () => { setReferenceDraft(""); setReferenceFilter(""); setSelectedReference(null); };
  const updateStatusFilter = (nextFilter: OpnameHistoryStatusFilter) => {
    setSelectedReference(null);
    navigate(nextFilter === "all" ? "/inventory/opname-history" : `/inventory/opname-history?status=${nextFilter}`);
  };

  return <AppShell active="inventory" eyebrow="Inventory" title="Riwayat Opname"><PageHeader eyebrow="PERSEDIAAN" title="Riwayat Sesi Opname" description="Telusuri sesi hitung fisik yang tersimpan melalui nomor referensi audit batch pada ledger stok." action={<a className="button ghost" href="/inventory"><ArrowLeft size={16} /> Kembali ke Inventory</a>} />
    <Panel title="Filter Riwayat Opname" description="Masukkan seluruh atau sebagian nomor referensi audit, lalu pilih status tindak lanjut yang ingin ditampilkan."><form className="opname-history-filter" onSubmit={submitFilter}><label className="field"><span>Nomor referensi</span><div className="opname-filter-input"><Search size={16} /><input className="form-input" value={referenceDraft} onChange={(event) => setReferenceDraft(event.target.value)} placeholder="Contoh: OPN-1724-ABCDE" /></div></label><label className="field"><span>Status tindak lanjut</span><select className="form-input" value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value as OpnameHistoryStatusFilter)}><option value="all">Semua status</option><option value="open">Sesi terbuka</option><option value="needs_follow_up">Perlu tindak lanjut</option><option value="in_progress">Sedang ditindaklanjuti</option><option value="resolved">Selesai ditindaklanjuti</option></select></label><div className="form-actions"><button className="button primary" type="submit">Terapkan filter</button>{referenceFilter && <button className="button ghost" type="button" onClick={resetFilter}><X size={15} /> Hapus referensi</button>}{statusFilter !== "all" && <button className="button ghost" type="button" onClick={() => updateStatusFilter("all")}><X size={15} /> Hapus status</button>}</div></form></Panel>
    <Panel title="Sesi Tersimpan" description={referenceFilter ? `Hasil untuk referensi yang memuat “${referenceFilter}”.` : statusFilter !== "all" ? `Hasil untuk status ${statusFilter === "open" ? "sesi terbuka" : followUpStatuses[statusFilter].label.toLowerCase()}.` : "Setiap sesi memuat semua bahan yang dicatat bersama dalam satu stock-opname fisik."}>{sessionsQuery.isLoading ? <Loading /> : sessionsQuery.isError ? <ErrorState message="Riwayat sesi opname belum dapat dimuat. Silakan coba lagi." /> : !sessions.length ? <EmptyState title={referenceFilter ? "Referensi audit tidak ditemukan." : statusFilter !== "all" ? "Belum ada sesi dengan status ini." : "Belum ada sesi opname fisik."} description={referenceFilter ? "Periksa nomor referensi, lalu coba terapkan filter kembali." : statusFilter !== "all" ? "Pilih status lain atau periksa kembali sesi stock-opname yang tersimpan." : "Mulai stock-opname dari halaman Inventory untuk membuat sesi audit pertama."} icon={ClipboardList} /> : <div className="opname-history-list">{sessions.map((session) => { const isOpen = selectedReference === session.reference; const status = followUpStatuses[session.followUpStatus]; const priority = getOpnameHistorySessionPriority({ ageDays: getJakartaCalendarDayAge(session.occurredAt), requiresFollowUp: session.differenceItems > 0, isResolved: session.followUpStatus === "resolved", thresholds: { warningAgeDays: settingsQuery.data?.opnameWarningAgeDays, criticalAgeDays: settingsQuery.data?.opnameCriticalAgeDays } }); const noteValue = noteDrafts[session.reference] ?? session.followUpNote ?? ""; const normalizedNote = noteValue.trim() || null; const savedNote = session.followUpNote?.trim() || null; const noteChanged = normalizedNote !== savedNote; return <article id={`opname-session-${session.reference}`} className={`opname-history-card ${isOpen ? "open" : ""}`} key={session.reference}><div className="opname-history-card-top"><div><span>Referensi audit</span><strong>{session.reference}</strong><small>{formatDate(session.occurredAt)} WIB{session.note ? ` · ${session.note}` : ""}</small><span className={`opname-session-priority ${priority.tone}`} title={priority.description}><SessionPriorityIcon tone={priority.tone} /><b>{priority.label}</b>{priority.ageDays !== null && <small>· {priority.ageDays} hari</small>}</span></div><button className="button ghost compact-button" type="button" onClick={() => setSelectedReference((current) => current === session.reference ? null : session.reference)} aria-expanded={isOpen}>{isOpen ? "Tutup rincian" : "Lihat bahan"}</button></div><div className="opname-history-metrics"><div><span>Bahan dicatat</span><strong>{session.totalItems}</strong></div><div><span>Bahan berselisih</span><strong>{session.differenceItems}</strong></div><div><span>Total selisih absolut</span><strong>{formatQuantity(session.totalAbsoluteDifference)}</strong></div></div><div className="opname-follow-up"><div><span>Status tindak lanjut</span><strong className={`opname-status ${status.className}`}>{status.label}</strong></div>{session.differenceItems > 0 ? <label className="opname-status-control"><span>Ubah status</span><select className="form-input" aria-label={`Status tindak lanjut ${session.reference}`} value={session.followUpStatus} disabled={updateFollowUp.isPending} onChange={(event) => updateFollowUp.mutate({ reference: session.reference, status: event.target.value as "needs_follow_up" | "in_progress" | "resolved" })}><option value="needs_follow_up">Perlu tindak lanjut</option><option value="in_progress">Sedang ditindaklanjuti</option><option value="resolved">Selesai ditindaklanjuti</option></select></label> : <small>Semua bahan sesuai hasil hitung fisik.</small>}</div>{session.differenceItems > 0 && <div className="opname-follow-up-note"><label className="field"><span>Catatan tindak lanjut</span><textarea className="form-input" aria-label={`Catatan tindak lanjut ${session.reference}`} rows={3} maxLength={1000} value={noteValue} onChange={(event) => setNoteDrafts((current) => ({ ...current, [session.reference]: event.target.value }))} placeholder="Contoh: Selisih telah diperiksa dengan catatan penerimaan bahan." /></label><div className="opname-note-actions"><small>{noteValue.length}/1000 karakter</small><button className="button ghost compact-button" type="button" disabled={!noteChanged || updateFollowUpNote.isPending} onClick={() => updateFollowUpNote.mutate({ reference: session.reference, note: normalizedNote })}>{normalizedNote ? "Simpan catatan" : "Hapus catatan"}</button></div></div>}{updateFollowUp.isError && <p className="opname-follow-up-error">Status belum tersimpan. {updateFollowUp.error.message}</p>}{updateFollowUpNote.isError && updateFollowUpNote.variables?.reference === session.reference && <p className="opname-follow-up-error">Catatan belum tersimpan. {updateFollowUpNote.error.message}</p>}{isOpen && <div className="opname-history-detail"><div className="table-wrap"><table><thead><tr><th>Bahan</th><th>Selisih opname</th><th>Saldo setelah opname</th></tr></thead><tbody>{session.items.map((item) => <tr key={item.id}><td><strong>{item.ingredientName}</strong><small>{item.unit}</small></td><td><strong className={item.quantityDelta === 0 ? "opname-match" : item.quantityDelta > 0 ? "opname-over" : "opname-under"}>{item.quantityDelta > 0 ? "+" : ""}{formatQuantity(item.quantityDelta)} {item.unit}</strong></td><td>{formatQuantity(item.balanceAfter)} {item.unit}</td></tr>)}</tbody></table></div></div>}</article>; })}</div>}</Panel>
  </AppShell>;
}
