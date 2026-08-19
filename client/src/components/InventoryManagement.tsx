import { useState } from "react";
import { ArrowDownUp, Edit3, Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import { inventoryEmptyStates } from "@/lib/emptyStates";

const emptyIngredient = { name: "", unit: "", costPerUnit: "", minimumStock: "", isActive: true };
type MovementType = "purchase" | "adjustment" | "waste" | "opname";
const emptyMovement: { ingredientId: string; type: MovementType; quantity: string; note: string } = { ingredientId: "", type: "purchase", quantity: "", note: "" };

const manualMovementLabels: Record<MovementType, string> = { purchase: "Pembelian", adjustment: "Penyesuaian", waste: "Waste", opname: "Stok Opname" };
const movementLabels: Record<MovementType | "sale" | "void" | "refund" | "partial_refund" | "exchange_return" | "exchange_sale", string> = { ...manualMovementLabels, sale: "Penjualan", void: "Void · Stok dipulihkan", refund: "Refund · Stok dipulihkan", partial_refund: "Refund sebagian · Stok dipulihkan", exchange_return: "Penukaran · Stok dikembalikan", exchange_sale: "Penukaran · Produk pengganti" };
const formatCurrency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const formatQuantity = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);
const formatDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Loading() { return <div className="loading-state"><span className="loading-dot" /> Memuat inventory…</div>; }
function StockState({ current, minimum }: { current: number; minimum: number }) {
  const low = minimum > 0 && current <= minimum;
  return <span className={`badge ${low ? "neutral" : "success"}`}>{low ? "Stok rendah" : "Aman"}</span>;
}

export function InventoryManagement() {
  const utils = trpc.useUtils();
  const ingredientQuery = trpc.ingredient.list.useQuery();
  const movementQuery = trpc.stockMovement.list.useQuery();
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [ingredientForm, setIngredientForm] = useState(emptyIngredient);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [editingId, setEditingId] = useState<number | null>(null);
  const refresh = () => { utils.ingredient.list.invalidate(); utils.stockMovement.list.invalidate(); };

  const create = trpc.ingredient.create.useMutation({ onSuccess: () => { toast.success("Bahan berhasil disimpan."); setIngredientOpen(false); setIngredientForm(emptyIngredient); refresh(); }, onError: (error) => toast.error(error.message || "Bahan gagal disimpan. Silakan coba lagi.") });
  const update = trpc.ingredient.update.useMutation({ onSuccess: () => { toast.success("Bahan berhasil diperbarui."); setIngredientOpen(false); setEditingId(null); setIngredientForm(emptyIngredient); refresh(); }, onError: (error) => toast.error(error.message || "Bahan gagal disimpan. Silakan coba lagi.") });
  const record = trpc.stockMovement.record.useMutation({ onSuccess: () => { toast.success("Pergerakan stok berhasil dicatat."); setMovementOpen(false); setMovementForm(emptyMovement); refresh(); }, onError: (error) => toast.error(error.message || "Pergerakan stok gagal disimpan. Silakan coba lagi.") });

  const saveIngredient = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ingredientForm.name.trim()) return toast.error("Nama bahan wajib diisi.");
    if (!ingredientForm.unit.trim()) return toast.error("Satuan wajib diisi.");
    const data = { name: ingredientForm.name, unit: ingredientForm.unit, costPerUnit: Number(ingredientForm.costPerUnit), minimumStock: Number(ingredientForm.minimumStock), isActive: ingredientForm.isActive };
    if (!Number.isFinite(data.costPerUnit)) return toast.error("Harga per satuan harus berupa angka.");
    if (!Number.isFinite(data.minimumStock) || data.minimumStock < 0) return toast.error("Stok minimum harus berupa angka nol atau lebih.");
    editingId ? update.mutate({ id: editingId, data }) : create.mutate(data);
  };
  const saveMovement = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(movementForm.quantity);
    if (!movementForm.ingredientId) return toast.error("Bahan wajib dipilih.");
    if (!Number.isFinite(quantity)) return toast.error("Jumlah stok harus berupa angka.");
    if ((movementForm.type === "purchase" || movementForm.type === "waste") && quantity <= 0) return toast.error("Jumlah harus lebih dari nol.");
    if (movementForm.type === "adjustment" && quantity === 0) return toast.error("Penyesuaian tidak boleh bernilai nol.");
    if (movementForm.type === "opname" && quantity < 0) return toast.error("Hasil stok opname tidak boleh negatif.");
    record.mutate({ ingredientId: Number(movementForm.ingredientId), type: movementForm.type, quantity, note: movementForm.note || null });
  };

  const ingredients = ingredientQuery.data || [];
  const movements = movementQuery.data || [];
  const emptyStates = inventoryEmptyStates(ingredients.length, movements.length);
  return <AppShell active="inventory" eyebrow="Inventory" title="Inventory"><PageHeader eyebrow="PERSEDIAAN" title="Inventory" description="Pantau saldo stok bahan dan catat setiap perubahan secara permanen." action={<div className="header-actions"><button className="button secondary" onClick={() => setMovementOpen((value) => !value)} disabled={!ingredients.length}><ArrowDownUp size={16} /> Catat stok</button><button className="button primary" onClick={() => { setIngredientForm(emptyIngredient); setEditingId(null); setIngredientOpen(true); }}><Plus size={16} /> Tambah bahan</button></div>} />
    {ingredientQuery.isLoading ? <Loading /> : <>
      {ingredientOpen && <Panel title={editingId ? "Edit Ingredient" : "Create Ingredient"} description="Saldo awal bahan dimulai dari 0 dan berubah melalui catatan stok."><form className="form-grid" onSubmit={saveIngredient}><Field label="Ingredient Name"><input className="form-input" value={ingredientForm.name} onChange={(event) => setIngredientForm({ ...ingredientForm, name: event.target.value })} /></Field><Field label="Unit"><input className="form-input" value={ingredientForm.unit} onChange={(event) => setIngredientForm({ ...ingredientForm, unit: event.target.value })} placeholder="Contoh: liter" /></Field><Field label="Cost per Unit"><input className="form-input" inputMode="decimal" value={ingredientForm.costPerUnit} onChange={(event) => setIngredientForm({ ...ingredientForm, costPerUnit: event.target.value })} /></Field><Field label="Minimum Stock"><input className="form-input" inputMode="decimal" value={ingredientForm.minimumStock} onChange={(event) => setIngredientForm({ ...ingredientForm, minimumStock: event.target.value })} /></Field><Field label="Status"><select className="form-input" value={String(ingredientForm.isActive)} onChange={(event) => setIngredientForm({ ...ingredientForm, isActive: event.target.value === "true" })}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></Field><div className="form-actions"><button className="button ghost" type="button" onClick={() => setIngredientOpen(false)}>Cancel</button><button className="button primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? "Menyimpan…" : "Save Ingredient"}</button></div></form></Panel>}
      {movementOpen && <Panel title="Catat Pergerakan Stok" description="Pembelian menambah stok; waste mengurangi stok; penyesuaian menerima nilai plus atau minus; opname menggunakan jumlah fisik sebagai saldo akhir."><form className="form-grid" onSubmit={saveMovement}><Field label="Bahan"><select className="form-input" value={movementForm.ingredientId} onChange={(event) => setMovementForm({ ...movementForm, ingredientId: event.target.value })}><option value="">Pilih bahan</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} · {formatQuantity(ingredient.currentStock)} {ingredient.unit}</option>)}</select></Field><Field label="Tipe pergerakan"><select className="form-input" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value as MovementType })}>{Object.entries(manualMovementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label={movementForm.type === "opname" ? "Jumlah fisik" : movementForm.type === "adjustment" ? "Jumlah penyesuaian (+/-)" : "Jumlah"}><input className="form-input" inputMode="decimal" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} placeholder={movementForm.type === "opname" ? "Contoh: 12,5" : "Contoh: 5"} /></Field><Field label="Catatan (opsional)"><input className="form-input" value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} placeholder="Contoh: Pembelian supplier pagi" /></Field><div className="form-actions"><button type="button" className="button ghost" onClick={() => setMovementOpen(false)}>Cancel</button><button className="button primary" disabled={record.isPending}>{record.isPending ? "Mencatat…" : "Simpan pergerakan"}</button></div></form></Panel>}
      <Panel title="Saldo Bahan" description="Saldo saat ini diperbarui otomatis setelah pergerakan stok berhasil dicatat.">{ingredientQuery.isError ? <ErrorState message="Bahan gagal dimuat. Silakan coba lagi." /> : emptyStates.showIngredientEmptyState ? <EmptyState title="Belum ada bahan." description="Tambahkan bahan pertama, lalu catat pembelian untuk memulai saldo stok." /> : <div className="table-wrap"><table><thead><tr><th>Ingredient</th><th>Saldo saat ini</th><th>Minimum</th><th>Cost / Unit</th><th>Status stok</th><th>Data</th></tr></thead><tbody>{ingredients.map((ingredient) => <tr key={ingredient.id}><td><strong>{ingredient.name}</strong><small>{ingredient.unit}</small></td><td><strong>{formatQuantity(ingredient.currentStock)} {ingredient.unit}</strong></td><td>{formatQuantity(ingredient.minimumStock)} {ingredient.unit}</td><td>{formatCurrency(ingredient.costPerUnit)}</td><td><StockState current={ingredient.currentStock} minimum={ingredient.minimumStock} /></td><td><button className="icon-button" aria-label={`Edit ${ingredient.name}`} onClick={() => { setIngredientForm({ name: ingredient.name, unit: ingredient.unit, costPerUnit: String(ingredient.costPerUnit), minimumStock: String(ingredient.minimumStock), isActive: ingredient.isActive }); setEditingId(ingredient.id); setIngredientOpen(true); }}><Edit3 size={15} /></button></td></tr>)}</tbody></table></div>}</Panel>
      <Panel title="Riwayat Pergerakan" description="Setiap catatan menyimpan perubahan saldo dan nilai saldo setelah pergerakan.">{movementQuery.isLoading ? <Loading /> : movementQuery.isError ? <ErrorState message="Riwayat stok gagal dimuat. Silakan coba lagi." /> : emptyStates.showMovementEmptyState ? <EmptyState title="Belum ada pergerakan stok." description="Gunakan tombol Catat stok untuk mencatat pembelian, waste, penyesuaian, atau stok opname." /> : <div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Bahan</th><th>Tipe</th><th>Perubahan</th><th>Saldo akhir</th><th>Referensi</th><th>Catatan</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.occurredAt)}</td><td><strong>{movement.ingredientName}</strong><small>{movement.unit}</small></td><td>{movementLabels[movement.type as MovementType | "sale" | "void" | "refund" | "partial_refund" | "exchange_return" | "exchange_sale"]}</td><td><strong>{movement.quantityDelta > 0 ? "+" : ""}{formatQuantity(movement.quantityDelta)} {movement.unit}</strong></td><td>{formatQuantity(movement.balanceAfter)} {movement.unit}</td><td>{movement.saleReceiptNumber || movement.saleId ? <><strong>{movement.saleReceiptNumber || `Penjualan #${movement.saleId}`}</strong>{movement.saleItemId && <small>Item #{movement.saleItemId}{movement.saleItemProductName ? ` · ${movement.saleItemProductName}` : ""}</small>}{movement.exchangeId && <small>Penukaran #{movement.exchangeId}</small>}</> : "—"}</td><td>{movement.note || "—"}</td></tr>)}</tbody></table></div>}</Panel>
    </>}
  </AppShell>;
}
