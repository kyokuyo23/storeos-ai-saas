import { useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus, ReceiptText, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import { isCollectionEmpty } from "@/lib/emptyStates";

const formatCurrency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const formatDate = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
const formatQuantity = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value);

export function SalePOS() {
  const utils = trpc.useUtils();
  const productQuery = trpc.product.list.useQuery();
  const recipeQuery = trpc.recipe.list.useQuery();
  const ingredientQuery = trpc.ingredient.list.useQuery();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [receipt, setReceipt] = useState<{ receiptNumber: string; total: number; lines: Array<{ productId: number; quantity: number }> } | null>(null);
  const recipeByProduct = useMemo(() => new Map((recipeQuery.data || []).filter((recipe) => recipe.items.length).map((recipe) => [recipe.productId, recipe])), [recipeQuery.data]);
  const products = useMemo(() => (productQuery.data || []).filter((product) => product.isActive && recipeByProduct.has(product.id)), [productQuery.data, recipeByProduct]);
  const cartItems = useMemo(() => products.flatMap((product) => cart[product.id] ? [{ product, quantity: cart[product.id] }] : []), [cart, products]);
  const requirements = useMemo(() => {
    const total = new Map<number, number>();
    cartItems.forEach(({ product, quantity }) => recipeByProduct.get(product.id)?.items.forEach((item) => total.set(item.ingredientId, (total.get(item.ingredientId) || 0) + item.quantity * quantity)));
    return total;
  }, [cartItems, recipeByProduct]);
  const ingredientById = useMemo(() => new Map((ingredientQuery.data || []).map((ingredient) => [ingredient.id, ingredient])), [ingredientQuery.data]);
  const shortages = useMemo(() => Array.from(requirements.entries()).flatMap(([ingredientId, required]) => {
    const ingredient = ingredientById.get(ingredientId);
    return !ingredient || !ingredient.isActive || ingredient.currentStock < required ? [{ name: ingredient?.name || "Bahan resep", required, current: ingredient?.currentStock || 0, unit: ingredient?.unit || "" }] : [];
  }), [requirements, ingredientById]);
  const total = cartItems.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const complete = trpc.sale.complete.useMutation({
    onSuccess: (sale) => { setReceipt(sale); setCart({}); utils.ingredient.list.invalidate(); utils.stockMovement.list.invalidate(); utils.sale.list.invalidate(); toast.success("Penjualan selesai dan stok bahan telah diperbarui."); },
    onError: (error) => toast.error(error.message || "Penjualan gagal diselesaikan. Silakan coba lagi."),
  });
  const adjust = (productId: number, change: number) => setCart((current) => {
    const quantity = Math.max(0, (current[productId] || 0) + change);
    const next = { ...current }; if (quantity) next[productId] = quantity; else delete next[productId]; return next;
  });
  const ready = !productQuery.isLoading && !recipeQuery.isLoading && !ingredientQuery.isLoading;

  return <AppShell active="pos" eyebrow="Operasional" title="POS"><PageHeader eyebrow="POINT OF SALE" title="POS" description="Selesaikan penjualan produk yang memiliki resep untuk memotong stok bahan secara otomatis." />
    {!ready ? <div className="loading-state"><span className="loading-dot" /> Memuat produk dan stok…</div> : productQuery.isError || recipeQuery.isError || ingredientQuery.isError ? <ErrorState message="Data POS belum dapat dimuat. Silakan coba lagi." /> : <>
      <Panel title="Produk siap dijual" description="Hanya produk aktif dengan resep lengkap yang ditampilkan.">{!products.length ? <EmptyState title="Belum ada produk siap dijual." description="Buat produk, resep dengan bahan, lalu catat saldo stok terlebih dahulu." /> : <div className="table-wrap"><table><thead><tr><th>Produk</th><th>Harga</th><th>Resep</th><th>Keranjang</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.categoryName}</small></td><td>{formatCurrency(product.sellingPrice)}</td><td>{recipeByProduct.get(product.id)?.items.length} bahan</td><td><div className="inline-action"><button className="icon-button" aria-label={`Kurangi ${product.name}`} onClick={() => adjust(product.id, -1)} disabled={!cart[product.id]}><Minus size={15} /></button><strong>{cart[product.id] || 0}</strong><button className="icon-button" aria-label={`Tambah ${product.name}`} onClick={() => adjust(product.id, 1)}><Plus size={15} /></button></div></td></tr>)}</tbody></table></div>}</Panel>
      <Panel title="Keranjang penjualan" description="Stok dicek berdasarkan total kebutuhan bahan dari seluruh produk di keranjang.">{!cartItems.length ? <EmptyState title="Keranjang masih kosong." description="Tambahkan produk siap jual untuk memulai transaksi." icon={ShoppingCart} /> : <><div className="table-wrap"><table><thead><tr><th>Produk</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>{cartItems.map(({ product, quantity }) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{quantity} {product.unit}</td><td>{formatCurrency(product.sellingPrice)}</td><td>{formatCurrency(product.sellingPrice * quantity)}</td></tr>)}</tbody></table></div><div className="inline-action"><strong>Total: {formatCurrency(total)}</strong><button className="button primary" disabled={Boolean(shortages.length) || complete.isPending} onClick={() => complete.mutate({ items: cartItems.map(({ product, quantity }) => ({ productId: product.id, quantity })) })}><ReceiptText size={16} /> {complete.isPending ? "Menyelesaikan…" : "Selesaikan penjualan"}</button></div>{shortages.length ? <div className="notice"><AlertTriangle size={16} /> Stok tidak cukup: {shortages.map((item) => `${item.name} membutuhkan ${formatQuantity(item.required)} ${item.unit}, tersedia ${formatQuantity(item.current)} ${item.unit}`).join("; ")}</div> : <p className="muted">Stok bahan mencukupi. Penyelesaian penjualan akan membuat catatan audit untuk setiap bahan resep.</p>}</>}</Panel>
      {receipt && <Panel title="Penjualan selesai" description="Simpan nomor transaksi ini sebagai referensi audit."><div className="inline-action"><div><strong>{receipt.receiptNumber}</strong><small>{receipt.lines.length} jenis produk · {formatCurrency(receipt.total)}</small></div><button className="button secondary" onClick={() => setReceipt(null)}>Tutup</button></div></Panel>}
    </>}
  </AppShell>;
}

type ReplacementDraft = { productId: string; quantity: string };
type ExchangeDraft = { returnedQuantity: string; reason: string; replacements: ReplacementDraft[] };
const newExchangeDraft = (): ExchangeDraft => ({ returnedQuantity: "", reason: "", replacements: [{ productId: "", quantity: "1" }] });

export function SalesHistory() {
  const utils = trpc.useUtils();
  const query = trpc.sale.list.useQuery();
  const productQuery = trpc.product.list.useQuery();
  const recipeQuery = trpc.recipe.list.useQuery();
  const sales = query.data || [];
  const [reasonBySale, setReasonBySale] = useState<Record<number, string>>({});
  const [partialReasonByItem, setPartialReasonByItem] = useState<Record<number, string>>({});
  const [partialQuantityByItem, setPartialQuantityByItem] = useState<Record<number, string>>({});
  const [exchangeDraftByItem, setExchangeDraftByItem] = useState<Record<number, ExchangeDraft>>({});
  const [settlementMethodByExchange, setSettlementMethodByExchange] = useState<Record<number, "cash" | "card">>({});
  const recipeProductIds = useMemo(() => new Set((recipeQuery.data || []).filter((recipe) => recipe.items.length > 0).map((recipe) => recipe.productId)), [recipeQuery.data]);
  const replacementProducts = useMemo(() => (productQuery.data || []).filter((product) => product.isActive && recipeProductIds.has(product.id)), [productQuery.data, recipeProductIds]);
  const replacementById = useMemo(() => new Map(replacementProducts.map((product) => [product.id, product])), [replacementProducts]);
  const refreshSalesData = () => { utils.sale.list.invalidate(); utils.ingredient.list.invalidate(); utils.stockMovement.list.invalidate(); };
  const reverse = trpc.sale.reverse.useMutation({
    onSuccess: (sale) => { refreshSalesData(); toast.success(`${sale.status === "voided" ? "Void" : "Refund"} berhasil dan stok bahan telah dipulihkan.`); },
    onError: (error) => toast.error(error.message || "Pembatalan transaksi gagal diproses."),
  });
  const partialRefund = trpc.sale.partialRefund.useMutation({
    onSuccess: () => { refreshSalesData(); toast.success("Refund sebagian berhasil dan stok bahan terkait telah dipulihkan."); },
    onError: (error) => toast.error(error.message || "Refund sebagian gagal diproses."),
  });
  const exchange = trpc.sale.exchange.useMutation({
    onSuccess: () => { refreshSalesData(); toast.success("Penukaran berhasil diproses dan saldo stok telah disesuaikan."); },
    onError: (error) => toast.error(error.message || "Penukaran gagal diproses."),
  });
  const settleExchange = trpc.sale.settleExchange.useMutation({
    onSuccess: (settlement) => { refreshSalesData(); toast.success(`Tambahan pembayaran ${formatCurrency(settlement.amount)} berhasil dicatat.`); },
    onError: (error) => toast.error(error.message || "Pembayaran penukaran gagal dicatat."),
  });
  const statusLabel = (status: "completed" | "partially_refunded" | "voided" | "refunded") => status === "completed" ? "Selesai" : status === "partially_refunded" ? "Diproses sebagian" : status === "voided" ? "Void" : "Refund";
  const isFinal = (status: "completed" | "partially_refunded" | "voided" | "refunded") => status === "voided" || status === "refunded";
  const updateExchangeDraft = (lineId: number, change: Partial<ExchangeDraft>) => setExchangeDraftByItem((current) => ({ ...current, [lineId]: { ...(current[lineId] || newExchangeDraft()), ...change } }));
  const updateReplacement = (lineId: number, index: number, change: Partial<ReplacementDraft>) => setExchangeDraftByItem((current) => {
    const draft = current[lineId] || newExchangeDraft();
    return { ...current, [lineId]: { ...draft, replacements: draft.replacements.map((replacement, replacementIndex) => replacementIndex === index ? { ...replacement, ...change } : replacement) } };
  });
  const addReplacement = (lineId: number) => setExchangeDraftByItem((current) => {
    const draft = current[lineId] || newExchangeDraft();
    return { ...current, [lineId]: { ...draft, replacements: [...draft.replacements, { productId: "", quantity: "1" }] } };
  });
  const removeReplacement = (lineId: number, index: number) => setExchangeDraftByItem((current) => {
    const draft = current[lineId] || newExchangeDraft();
    return { ...current, [lineId]: { ...draft, replacements: draft.replacements.filter((_, replacementIndex) => replacementIndex !== index) } };
  });

  return <AppShell active="sales" eyebrow="Operasional" title="Sales">
    <PageHeader eyebrow="RIWAYAT PENJUALAN" title="Sales" description="Refund sebagian memulihkan stok sesuai item dan jumlah yang dikembalikan. Penukaran mengembalikan stok item lama serta memotong stok produk pengganti dalam satu transaksi atomik." />
    {query.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat penjualan…</div> : query.isError ? <ErrorState message="Riwayat penjualan gagal dimuat. Silakan coba lagi." /> : <Panel title="Riwayat transaksi" description="Jumlah refund dan penukaran setiap item dibatasi oleh jumlah yang terjual. Semua perubahan stok disimpan dalam audit inventory.">
      {isCollectionEmpty(sales) ? <EmptyState title="Belum ada penjualan." description="Selesaikan transaksi melalui POS untuk menghasilkan riwayat dan potongan stok otomatis." icon={ReceiptText} /> : <div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Nomor transaksi</th><th>Status</th><th>Item, refund & penukaran</th><th>Total</th><th>Aksi transaksi</th></tr></thead><tbody>
        {sales.map((sale) => <tr key={sale.id}><td>{formatDate(sale.completedAt)}</td><td><strong>{sale.receiptNumber}</strong></td><td><span className={`badge ${sale.status === "completed" ? "success" : "neutral"}`}>{statusLabel(sale.status)}</span>{sale.reversedAt && <small>{formatDate(sale.reversedAt)}</small>}</td><td>{sale.lines.map((line) => {
          const exchangeDraft = exchangeDraftByItem[line.id] || newExchangeDraft();
          const returnedQuantity = Number(exchangeDraft.returnedQuantity);
          const returnedTotal = Number.isInteger(returnedQuantity) && returnedQuantity > 0 ? line.unitPrice * returnedQuantity : 0;
          const replacementTotal = exchangeDraft.replacements.reduce((sum, replacement) => sum + (replacementById.get(Number(replacement.productId))?.sellingPrice || 0) * (Number(replacement.quantity) || 0), 0);
          const difference = replacementTotal - returnedTotal;
          return <div className="sale-line-refund" key={line.id}><strong>{line.productName}</strong><small>Terjual {line.quantity} · Direfund {line.refundedQuantity} · Ditukar {line.exchangedQuantity} · Sisa {line.refundableQuantity}</small>
            {!isFinal(sale.status) && line.refundableQuantity > 0 && <><div className="reversal-actions"><input className="form-input" aria-label={`Jumlah refund ${line.productName}`} inputMode="numeric" type="number" min="1" max={line.refundableQuantity} value={partialQuantityByItem[line.id] || ""} onChange={(event) => setPartialQuantityByItem((current) => ({ ...current, [line.id]: event.target.value }))} placeholder="Jumlah refund" /><input className="form-input" aria-label={`Alasan refund ${line.productName}`} value={partialReasonByItem[line.id] || ""} onChange={(event) => setPartialReasonByItem((current) => ({ ...current, [line.id]: event.target.value }))} placeholder="Alasan refund (opsional)" /><button className="button ghost" disabled={partialRefund.isPending || exchange.isPending} onClick={() => { const quantity = Number(partialQuantityByItem[line.id]); if (!Number.isInteger(quantity) || quantity < 1) return toast.error("Masukkan jumlah refund yang valid."); partialRefund.mutate({ saleId: sale.id, saleItemId: line.id, quantity, reason: partialReasonByItem[line.id] || null }); }}>Refund item</button></div>
              <div className="reversal-actions"><input className="form-input" aria-label={`Jumlah item yang ditukar ${line.productName}`} inputMode="numeric" type="number" min="1" max={line.refundableQuantity} value={exchangeDraft.returnedQuantity} onChange={(event) => updateExchangeDraft(line.id, { returnedQuantity: event.target.value })} placeholder="Jumlah ditukar" />
                {exchangeDraft.replacements.map((replacement, index) => <div className="inline-action" key={`${line.id}-${index}`}><select className="form-input" aria-label={`Produk pengganti ${index + 1} untuk ${line.productName}`} value={replacement.productId} onChange={(event) => updateReplacement(line.id, index, { productId: event.target.value })}><option value="">Pilih produk pengganti</option>{replacementProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatCurrency(product.sellingPrice)}</option>)}</select><input className="form-input" aria-label={`Jumlah produk pengganti ${index + 1} untuk ${line.productName}`} inputMode="numeric" type="number" min="1" value={replacement.quantity} onChange={(event) => updateReplacement(line.id, index, { quantity: event.target.value })} placeholder="Jumlah" />{exchangeDraft.replacements.length > 1 && <button className="icon-button" aria-label="Hapus produk pengganti" onClick={() => removeReplacement(line.id, index)}><Minus size={15} /></button>}</div>)}
                <button className="button ghost" onClick={() => addReplacement(line.id)}><Plus size={15} /> Tambah produk pengganti</button><input className="form-input" aria-label={`Alasan penukaran ${line.productName}`} value={exchangeDraft.reason} onChange={(event) => updateExchangeDraft(line.id, { reason: event.target.value })} placeholder="Alasan penukaran (opsional)" /><small>Nilai dikembalikan {formatCurrency(returnedTotal)} · Produk pengganti {formatCurrency(replacementTotal)} · {difference > 0 ? `Tambahan pembayaran ${formatCurrency(difference)}` : difference < 0 ? `Selisih pengembalian ${formatCurrency(Math.abs(difference))}` : "Nilai setara"}</small><button className="button secondary" disabled={exchange.isPending || partialRefund.isPending || !replacementProducts.length} onClick={() => { const replacementItems = exchangeDraft.replacements.map((replacement) => ({ productId: Number(replacement.productId), quantity: Number(replacement.quantity) })); if (!Number.isInteger(returnedQuantity) || returnedQuantity < 1 || returnedQuantity > line.refundableQuantity) return toast.error("Masukkan jumlah item yang ditukar sesuai sisa item."); if (replacementItems.some((item) => !Number.isInteger(item.productId) || item.productId < 1 || !Number.isInteger(item.quantity) || item.quantity < 1)) return toast.error("Pilih produk pengganti dan masukkan jumlah yang valid."); exchange.mutate({ saleId: sale.id, saleItemId: line.id, returnedQuantity, replacementItems, reason: exchangeDraft.reason || null }); }}>Proses penukaran</button></div></>}
            {line.partialRefunds.map((refund) => <small key={refund.id}>Refund {refund.quantity} · {formatDate(refund.createdAt)}{refund.reason ? ` — ${refund.reason}` : ""}</small>)}
            {line.exchanges.map((itemExchange) => <div className="inline-action" key={itemExchange.id}><small>Tukar {itemExchange.returnedQuantity} · Pengganti {itemExchange.items.map((replacement) => `${replacement.productName} ×${replacement.quantity}`).join(", ")} · Nilai kembali {formatCurrency(itemExchange.returnedTotal)} · Pengganti {formatCurrency(itemExchange.replacementTotal)} · {itemExchange.paymentAdjustment > 0 ? `Tambahan ${formatCurrency(itemExchange.paymentAdjustment)}` : itemExchange.paymentAdjustment < 0 ? `Pengembalian ${formatCurrency(Math.abs(itemExchange.paymentAdjustment))}` : "Nilai setara"} · {formatDate(itemExchange.createdAt)}{itemExchange.reason ? ` — ${itemExchange.reason}` : ""}</small>{itemExchange.paymentAdjustment > 0 && (itemExchange.settlement ? <small>Pembayaran diterima: {formatCurrency(itemExchange.settlement.amount)} · {itemExchange.settlement.paymentMethod === "cash" ? "Tunai" : "Kartu"} · {formatDate(itemExchange.settlement.createdAt)}</small> : <><select className="form-input" aria-label={`Metode pembayaran penukaran ${itemExchange.id}`} value={settlementMethodByExchange[itemExchange.id] || "cash"} onChange={(event) => setSettlementMethodByExchange((current) => ({ ...current, [itemExchange.id]: event.target.value as "cash" | "card" }))}><option value="cash">Tunai</option><option value="card">Kartu</option></select><button className="button ghost" disabled={settleExchange.isPending} onClick={() => settleExchange.mutate({ exchangeId: itemExchange.id, paymentMethod: settlementMethodByExchange[itemExchange.id] || "cash" })}>Catat pembayaran</button></>)}</div>)}
          </div>;
        })}</td><td>{formatCurrency(sale.total)}</td><td>{!isFinal(sale.status) ? <div className="reversal-actions"><input className="form-input" aria-label={`Alasan pembatalan ${sale.receiptNumber}`} value={reasonBySale[sale.id] || ""} onChange={(event) => setReasonBySale((current) => ({ ...current, [sale.id]: event.target.value }))} placeholder="Alasan (opsional)" /><button className="button ghost" disabled={reverse.isPending || partialRefund.isPending || exchange.isPending} onClick={() => reverse.mutate({ saleId: sale.id, type: "void", reason: reasonBySale[sale.id] || null })}>Void sisa</button><button className="button secondary" disabled={reverse.isPending || partialRefund.isPending || exchange.isPending} onClick={() => reverse.mutate({ saleId: sale.id, type: "refund", reason: reasonBySale[sale.id] || null })}>Refund sisa</button></div> : <small>{sale.reversalReason || "Stok telah dipulihkan."}</small>}</td></tr>)}
      </tbody></table></div>}
    </Panel>}
  </AppShell>;
}
