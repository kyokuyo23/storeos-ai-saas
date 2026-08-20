import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import "@/lib/opnameHistory.css";

const formatQuantity = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const formatDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);

function Loading() { return <div className="loading-state"><span className="loading-dot" /> Memuat riwayat sesi…</div>; }

export function StockOpnameHistory() {
  const [referenceDraft, setReferenceDraft] = useState("");
  const [referenceFilter, setReferenceFilter] = useState("");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const queryInput = useMemo(() => referenceFilter ? { reference: referenceFilter } : undefined, [referenceFilter]);
  const sessionsQuery = trpc.stockMovement.opnameSessions.useQuery(queryInput);
  const sessions = sessionsQuery.data ?? [];
  const submitFilter = (event: React.FormEvent) => { event.preventDefault(); setReferenceFilter(referenceDraft.trim()); setSelectedReference(null); };
  const resetFilter = () => { setReferenceDraft(""); setReferenceFilter(""); setSelectedReference(null); };

  return <AppShell active="inventory" eyebrow="Inventory" title="Riwayat Opname"><PageHeader eyebrow="PERSEDIAAN" title="Riwayat Sesi Opname" description="Telusuri sesi hitung fisik yang tersimpan melalui nomor referensi audit batch pada ledger stok." action={<a className="button ghost" href="/inventory"><ArrowLeft size={16} /> Kembali ke Inventory</a>} />
    <Panel title="Filter Referensi Audit" description="Masukkan seluruh atau sebagian nomor, misalnya OPN-1724, untuk menemukan satu sesi opname."><form className="opname-history-filter" onSubmit={submitFilter}><label className="field"><span>Nomor referensi</span><div className="opname-filter-input"><Search size={16} /><input className="form-input" value={referenceDraft} onChange={(event) => setReferenceDraft(event.target.value)} placeholder="Contoh: OPN-1724-ABCDE" /></div></label><div className="form-actions"><button className="button primary" type="submit">Terapkan filter</button>{referenceFilter && <button className="button ghost" type="button" onClick={resetFilter}><X size={15} /> Hapus filter</button>}</div></form></Panel>
    <Panel title="Sesi Tersimpan" description={referenceFilter ? `Hasil untuk referensi yang memuat “${referenceFilter}”.` : "Setiap sesi memuat semua bahan yang dicatat bersama dalam satu stock-opname fisik."}>{sessionsQuery.isLoading ? <Loading /> : sessionsQuery.isError ? <ErrorState message="Riwayat sesi opname belum dapat dimuat. Silakan coba lagi." /> : !sessions.length ? <EmptyState title={referenceFilter ? "Referensi audit tidak ditemukan." : "Belum ada sesi opname fisik."} description={referenceFilter ? "Periksa nomor referensi, lalu coba terapkan filter kembali." : "Mulai stock-opname dari halaman Inventory untuk membuat sesi audit pertama."} icon={ClipboardList} /> : <div className="opname-history-list">{sessions.map((session) => { const isOpen = selectedReference === session.reference; return <article className={`opname-history-card ${isOpen ? "open" : ""}`} key={session.reference}><div className="opname-history-card-top"><div><span>Referensi audit</span><strong>{session.reference}</strong><small>{formatDate(session.occurredAt)} WIB{session.note ? ` · ${session.note}` : ""}</small></div><button className="button ghost compact-button" type="button" onClick={() => setSelectedReference((current) => current === session.reference ? null : session.reference)} aria-expanded={isOpen}>{isOpen ? "Tutup rincian" : "Lihat bahan"}</button></div><div className="opname-history-metrics"><div><span>Bahan dicatat</span><strong>{session.totalItems}</strong></div><div><span>Bahan berselisih</span><strong>{session.differenceItems}</strong></div><div><span>Total selisih absolut</span><strong>{formatQuantity(session.totalAbsoluteDifference)}</strong></div></div>{isOpen && <div className="opname-history-detail"><div className="table-wrap"><table><thead><tr><th>Bahan</th><th>Selisih opname</th><th>Saldo setelah opname</th></tr></thead><tbody>{session.items.map((item) => <tr key={item.id}><td><strong>{item.ingredientName}</strong><small>{item.unit}</small></td><td><strong className={item.quantityDelta === 0 ? "opname-match" : item.quantityDelta > 0 ? "opname-over" : "opname-under"}>{item.quantityDelta > 0 ? "+" : ""}{formatQuantity(item.quantityDelta)} {item.unit}</strong></td><td>{formatQuantity(item.balanceAfter)} {item.unit}</td></tr>)}</tbody></table></div></div>}</article>; })}</div>}</Panel>
  </AppShell>;
}
