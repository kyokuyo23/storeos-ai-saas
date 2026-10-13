import { useMemo, useState } from "react";
import { Camera, CheckCircle2, ClipboardCheck, ImagePlus, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import "./shift-check.css";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1_500_000;
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const qty = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const signed = (value: number, format: (value: number) => string) => (value > 0 ? `+${format(value)}` : format(value));
const wib = (value: Date | string | null | undefined) => (value ? `${new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })} WIB` : "—");
const STATUS: Record<string, { label: string; tone: string }> = {
  matched: { label: "Sesuai", tone: "ok" },
  pending: { label: "Menunggu persetujuan", tone: "warn" },
  approved: { label: "Disetujui", tone: "ok" },
  rejected: { label: "Ditolak", tone: "bad" },
};

type Photo = { id: string; contentType: "image/jpeg"; dataBase64: string; previewUrl: string; bytes: number };

/** Downscale to ≤1600 px and re-encode as JPEG until it fits the 1.5 MB server limit. */
async function compressPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("File bukan gambar yang valid."); });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.78, 0.65, 0.5, 0.38]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_PHOTO_BYTES) {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < buffer.length; index += 0x8000) binary += String.fromCharCode.apply(null, Array.from(buffer.subarray(index, index + 0x8000)));
      return { id: crypto.randomUUID(), contentType: "image/jpeg", dataBase64: btoa(binary), previewUrl: URL.createObjectURL(blob), bytes: blob.size };
    }
  }
  throw new Error("Foto terlalu besar meski sudah dikompres.");
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, tone: "" };
  return <span className={`shift-status ${meta.tone}`}>{meta.label}</span>;
}

function ShiftCheckForm({ onSubmitted }: { onSubmitted: () => void }) {
  const items = trpc.shiftCheck.items.useQuery();
  const settings = trpc.settings.get.useQuery();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [cash, setCash] = useState("");
  const [nonCash, setNonCash] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busyPhotos, setBusyPhotos] = useState(false);
  const [result, setResult] = useState<{ reference: string; status: string; varianceItemCount: number; totalVarianceValue: number; incomeVariance: number } | null>(null);
  const submit = trpc.shiftCheck.submit.useMutation({
    onSuccess: (data) => { setResult(data); setCounts({}); setCash(""); setNonCash(""); setNote(""); photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)); setPhotos([]); onSubmitted(); toast.success(`Cek ${data.reference} terkirim.`); },
    onError: (error) => toast.error(error.message || "Cek shift gagal dikirim."),
  });

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`Maksimal ${MAX_PHOTOS} foto.`); return; }
    setBusyPhotos(true);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files).slice(0, room)) added.push(await compressPhoto(file));
      setPhotos((current) => [...current, ...added]);
      if (files.length > room) toast.info(`Hanya ${room} foto pertama yang ditambahkan (maks. ${MAX_PHOTOS}).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto gagal diproses.");
    } finally { setBusyPhotos(false); }
  };

  const list = items.data ?? [];
  const allCounted = list.length > 0 && list.every((item) => counts[item.id] !== undefined && counts[item.id] !== "" && Number(counts[item.id]) >= 0);
  const ready = allCounted && photos.length >= 1 && cash !== "" && nonCash !== "" && !submit.isPending && !busyPhotos;
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    submit.mutate({ counts: list.map((item) => ({ ingredientId: item.id, countedQuantity: Number(counts[item.id]) })), photos: photos.map(({ contentType, dataBase64 }) => ({ contentType, dataBase64 })), countedCash: Number(cash), countedNonCash: Number(nonCash), note: note.trim() || null });
  };

  if (items.isLoading) return <div className="loading-state"><span className="loading-dot" /> Memuat daftar barang…</div>;
  if (items.isError) return <ErrorState message={items.error.message || "Daftar barang gagal dimuat."} />;
  if (!list.length) return <EmptyState title="Belum ada barang untuk dicek." description="Pemilik atau admin sistem perlu menandai bahan (mis. gelas cup, sachet, gula) di Inventory → kolom “Cek shift”." icon={ClipboardCheck} />;

  return <form className="shift-form" onSubmit={send}>
    {result && <div className={`shift-result ${result.status === "matched" ? "ok" : "warn"}`} role="status">
      {result.status === "matched" ? <CheckCircle2 size={20} /> : <ClipboardCheck size={20} />}
      <div><strong>{result.reference} terkirim · <StatusChip status={result.status} /></strong>
        <span>{result.status === "matched" ? "Stok dan pemasukan sesuai dengan sistem." : `Selisih stok ${result.varianceItemCount} barang (${rupiah(result.totalVarianceValue)}), selisih pemasukan ${rupiah(result.incomeVariance)}. Menunggu persetujuan pemilik/admin sistem.`}</span></div>
      <button type="button" className="icon-button" aria-label="Tutup" onClick={() => setResult(null)}><X size={14} /></button>
    </div>}
    <section>
      <h3>1. Hitung barang</h3>
      <p className="shift-help">Hitung fisik setiap barang. Angka sistem sengaja tidak ditampilkan.</p>
      <div className="shift-count-grid">{list.map((item) => <label key={item.id} className="field"><span>{item.name} <small>({item.unit})</small></span><input className="form-input" type="number" inputMode="decimal" min="0" step="any" required value={counts[item.id] ?? ""} onChange={(event) => setCounts({ ...counts, [item.id]: event.target.value })} placeholder="0" /></label>)}</div>
    </section>
    <section>
      <h3>2. Hitung uang</h3>
      <p className="shift-help">Modal kas awal shift: <strong>{rupiah(settings.data?.shiftOpeningCash ?? 0)}</strong> (sudah termasuk di uang laci, sistem akan menguranginya).</p>
      <div className="shift-count-grid">
        <label className="field"><span>Uang tunai di laci (Rp)</span><input className="form-input" type="number" inputMode="numeric" min="0" step="1" required value={cash} onChange={(event) => setCash(event.target.value)} placeholder="0" /></label>
        <label className="field"><span>Non-tunai: EDC/QRIS/transfer (Rp)</span><input className="form-input" type="number" inputMode="numeric" min="0" step="1" required value={nonCash} onChange={(event) => setNonCash(event.target.value)} placeholder="0" /></label>
      </div>
    </section>
    <section>
      <h3>3. Foto bukti ({photos.length}/{MAX_PHOTOS})</h3>
      <p className="shift-help">Foto barang yang dihitung (dan laci kas bila perlu). Minimal 1, maksimal 3 foto.</p>
      <div className="shift-photos">
        {photos.map((photo) => <figure key={photo.id}><img src={photo.previewUrl} alt="Foto bukti" /><button type="button" aria-label="Hapus foto" onClick={() => { URL.revokeObjectURL(photo.previewUrl); setPhotos(photos.filter((entry) => entry.id !== photo.id)); }}><X size={14} /></button></figure>)}
        {photos.length < MAX_PHOTOS && <label className="shift-photo-add">{busyPhotos ? <span className="loading-dot" /> : <><Camera size={20} /><span>Ambil / pilih foto</span></>}<input type="file" accept="image/*" capture="environment" multiple onChange={(event) => { void addPhotos(event.target.files); event.target.value = ""; }} disabled={busyPhotos} /></label>}
      </div>
    </section>
    <label className="field"><span>Catatan (opsional)</span><input className="form-input" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Mis. 2 gelas pecah saat dicuci" /></label>
    <div className="form-actions"><button className="button primary" disabled={!ready}><Send size={16} /> {submit.isPending ? "Mengirim…" : "Kirim cek akhir shift"}</button></div>
  </form>;
}

function ShiftCheckDetail({ id, canManage, myId, onClose, onReviewed }: { id: number; canManage: boolean; myId: number; onClose: () => void; onReviewed: () => void }) {
  const detail = trpc.shiftCheck.get.useQuery({ id });
  const [note, setNote] = useState("");
  const review = trpc.shiftCheck.review.useMutation({
    onSuccess: (data) => { toast.success(data.status === "approved" ? "Cek disetujui. Stok disesuaikan." : "Cek ditolak. Stok tidak berubah."); setNote(""); onReviewed(); },
    onError: (error) => toast.error(error.message || "Peninjauan gagal."),
  });
  const auth = useAuth();
  if (detail.isLoading) return <div className="loading-state"><span className="loading-dot" /> Memuat detail…</div>;
  if (detail.isError || !detail.data) return <ErrorState message={detail.error?.message || "Detail cek tidak dapat dimuat."} />;
  const check = detail.data;
  const totals = check.items.reduce((sum, item) => ({ opening: sum.opening + item.openingValue, purchase: sum.purchase + item.purchaseValue, usage: sum.usage + item.usageValue, system: sum.system + item.systemValue, counted: sum.counted + item.countedValue, variance: sum.variance + item.varianceValue }), { opening: 0, purchase: 0, usage: 0, system: 0, counted: 0, variance: 0 });
  const received = check.countedCash - check.openingCash + check.countedNonCash;
  const canReview = canManage && check.status === "pending" && (auth.user?.isOwner || check.submittedByUserId !== myId);
  return <div className="shift-detail">
    <div className="shift-detail-head"><div><span className="eyebrow">{check.reference}</span><h3>{check.submittedByName} · <StatusChip status={check.status} /></h3><small>Shift {wib(check.shiftStartedAt)} → {wib(check.submittedAt)}</small></div><button type="button" className="button ghost compact-button" onClick={onClose}>Tutup</button></div>
    {check.note && <p className="notice">Catatan kasir: {check.note}</p>}
    <h4>Rekonsiliasi stok</h4>
    <div className="table-wrap"><table className="shift-table"><thead><tr><th>Barang</th><th>Stok awal</th><th>+ Pembelian</th><th>− Terpakai (penjualan)</th><th>± Lain-lain</th><th>= Seharusnya</th><th>Fisik</th><th>Selisih</th><th>Selisih (Rp)</th></tr></thead><tbody>
      {check.items.map((item) => <tr key={item.ingredientId} className={item.variance !== 0 ? "has-variance" : ""}><td><strong>{item.ingredientName}</strong><small>{item.unit} · {rupiah(item.costPerUnit)}/{item.unit}</small></td><td>{qty(item.openingQuantity)}</td><td>{qty(item.purchaseQuantity)}</td><td>{qty(item.usageQuantity)}</td><td>{signed(item.otherQuantity, qty)}</td><td><strong>{qty(item.systemQuantity)}</strong></td><td><strong>{qty(item.countedQuantity)}</strong></td><td className={item.variance < 0 ? "neg" : item.variance > 0 ? "pos" : ""}>{signed(item.variance, qty)}</td><td className={item.varianceValue < 0 ? "neg" : item.varianceValue > 0 ? "pos" : ""}>{signed(item.varianceValue, rupiah)}</td></tr>)}
      <tr className="shift-total"><td>Nilai (Rp)</td><td>{rupiah(totals.opening)}</td><td>{rupiah(totals.purchase)}</td><td>{rupiah(totals.usage)}</td><td>—</td><td>{rupiah(totals.system)}</td><td>{rupiah(totals.counted)}</td><td colSpan={2} className={totals.variance < 0 ? "neg" : totals.variance > 0 ? "pos" : ""}>{signed(totals.variance, rupiah)}</td></tr>
    </tbody></table></div>
    <h4>Rekonsiliasi pemasukan</h4>
    <div className="shift-income">
      <div><span>Transaksi</span><strong>{check.saleCount}</strong></div>
      <div><span>Penjualan kotor</span><strong>{rupiah(check.grossSales)}</strong></div>
      <div><span>Void / refund</span><strong>{rupiah(check.voidRefundValue)}</strong></div>
      <div><span>Seharusnya (penjualan bersih)</span><strong>{rupiah(check.netSales)}</strong></div>
      <div><span>Diterima</span><strong>{rupiah(received)}</strong><small>Tunai {rupiah(check.countedCash)} − modal {rupiah(check.openingCash)} + non-tunai {rupiah(check.countedNonCash)}</small></div>
      <div className={check.incomeVariance < 0 ? "neg" : check.incomeVariance > 0 ? "pos" : ""}><span>Selisih pemasukan</span><strong>{signed(check.incomeVariance, rupiah)}</strong></div>
    </div>
    <h4>Foto bukti</h4>
    <div className="shift-photos readonly">{check.photos.map((photo, index) => <a key={photo.id} href={`/api/shift-checks/photos/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/shift-checks/photos/${photo.id}`} alt={`Foto bukti ${index + 1}`} loading="lazy" /></a>)}</div>
    {check.reviewedAt && <p className="shift-help">Ditinjau oleh <strong>{check.reviewedByName}</strong> · {wib(check.reviewedAt)}{check.reviewNote ? ` · “${check.reviewNote}”` : ""}</p>}
    {canReview && <div className="shift-review">
      <label className="field"><span>Catatan peninjauan (wajib bila ditolak)</span><input className="form-input" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Mis. selisih karena gelas pecah, sudah dicek CCTV" /></label>
      <div className="form-actions"><button type="button" className="button ghost danger-text" disabled={review.isPending || !note.trim()} onClick={() => review.mutate({ id: check.id, decision: "reject", note })}><XCircle size={16} /> Tolak</button><button type="button" className="button primary" disabled={review.isPending} onClick={() => review.mutate({ id: check.id, decision: "approve", note: note.trim() || null })}><CheckCircle2 size={16} /> Setujui & sesuaikan stok</button></div>
      <p className="shift-help">Setujui: selisih stok diterapkan ke Inventory sebagai stock opname. Tolak: stok tidak berubah.</p>
    </div>}
    {canManage && check.status === "pending" && !canReview && <p className="notice">Cek yang Anda kirim harus ditinjau pemilik atau admin sistem lain.</p>}
  </div>;
}

export function ShiftCheckPage() {
  const utils = trpc.useUtils();
  const auth = useAuth();
  const canManage = Boolean(auth.user?.canManage);
  const [filter, setFilter] = useState<"pending" | "all">("all");
  const [selected, setSelected] = useState<number | null>(null);
  const list = trpc.shiftCheck.list.useQuery(filter === "pending" ? { status: "pending" } : undefined);
  const pendingCount = useMemo(() => (list.data ?? []).filter((check) => check.status === "pending").length, [list.data]);
  const refresh = () => { utils.shiftCheck.list.invalidate(); utils.shiftCheck.get.invalidate(); utils.alerts.list.invalidate(); utils.ingredient.list.invalidate(); };

  return <AppShell active="shift" eyebrow="Anti-fraud" title="Cek Shift">
    <PageHeader eyebrow="AKHIR SHIFT" title="Cek Akhir Shift" description="Stok awal shift + pembelian − pemakaian penjualan = stok akhir seharusnya, dibandingkan dengan hitungan fisik (qty & Rupiah) dan uang yang diterima. Selisih menunggu persetujuan pemilik/admin sistem." />
    <Panel title="Kirim cek akhir shift" description="Isi di akhir setiap shift sebelum serah terima."><ShiftCheckForm onSubmitted={refresh} /></Panel>
    <Panel title={canManage ? "Riwayat cek semua kasir" : "Riwayat cek saya"} description={canManage ? "Klik baris untuk melihat rincian, foto, dan meninjau selisih." : "Klik baris untuk melihat rincian cek Anda."}>
      {canManage && <div className="shift-filter" role="tablist"><button type="button" className={`button ${filter === "all" ? "secondary" : "ghost"} compact-button`} onClick={() => setFilter("all")}>Semua</button><button type="button" className={`button ${filter === "pending" ? "secondary" : "ghost"} compact-button`} onClick={() => setFilter("pending")}>Menunggu persetujuan{filter === "all" && pendingCount ? ` (${pendingCount})` : ""}</button></div>}
      {list.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat riwayat…</div> : list.isError ? <ErrorState message={list.error.message || "Riwayat gagal dimuat."} /> : !list.data?.length ? <EmptyState title="Belum ada cek shift." description="Cek yang dikirim akan tampil di sini." icon={ImagePlus} /> : <div className="table-wrap"><table><thead><tr><th>Waktu kirim</th><th>Kasir</th><th>Status</th><th>Selisih stok</th><th>Selisih pemasukan</th><th>Penjualan bersih</th></tr></thead><tbody>{list.data.map((check) => <tr key={check.id} className={`shift-row ${selected === check.id ? "selected" : ""}`} onClick={() => setSelected(selected === check.id ? null : check.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(selected === check.id ? null : check.id); }}><td><strong>{wib(check.submittedAt)}</strong><small>{check.reference}</small></td><td>{check.submittedByName}</td><td><StatusChip status={check.status} /></td><td className={check.totalVarianceValue < 0 ? "neg" : ""}>{check.varianceItemCount ? `${check.varianceItemCount} barang · ${signed(check.totalVarianceValue, rupiah)}` : "—"}</td><td className={check.incomeVariance < 0 ? "neg" : ""}>{check.incomeVariance ? signed(check.incomeVariance, rupiah) : "—"}</td><td>{rupiah(check.netSales)}</td></tr>)}</tbody></table></div>}
      {selected !== null && auth.user && <ShiftCheckDetail id={selected} canManage={canManage} myId={auth.user.id} onClose={() => setSelected(null)} onReviewed={refresh} />}
    </Panel>
  </AppShell>;
}
