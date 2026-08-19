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

export function SalesHistory() {
  const utils = trpc.useUtils();
  const query = trpc.sale.list.useQuery();
  const sales = query.data || [];
  const [reasonBySale, setReasonBySale] = useState<Record<number, string>>({});
  const reverse = trpc.sale.reverse.useMutation({
    onSuccess: (sale) => { utils.sale.list.invalidate(); utils.ingredient.list.invalidate(); utils.stockMovement.list.invalidate(); toast.success(`${sale.status === "voided" ? "Void" : "Refund"} berhasil dan stok bahan telah dipulihkan.`); },
    onError: (error) => toast.error(error.message || "Pembatalan transaksi gagal diproses."),
  });
  const statusLabel = (status: "completed" | "voided" | "refunded") => status === "completed" ? "Selesai" : status === "voided" ? "Void" : "Refund";
  return <AppShell active="sales" eyebrow="Operasional" title="Sales"><PageHeader eyebrow="RIWAYAT PENJUALAN" title="Sales" description="Void dan refund memulihkan stok berdasarkan catatan pengurangan bahan dari transaksi asli." />{query.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat penjualan…</div> : query.isError ? <ErrorState message="Riwayat penjualan gagal dimuat. Silakan coba lagi." /> : <Panel title="Riwayat transaksi" description="Setiap pembatalan hanya dapat diproses satu kali dan selalu menambah catatan pemulihan stok.">{isCollectionEmpty(sales) ? <EmptyState title="Belum ada penjualan." description="Selesaikan transaksi melalui POS untuk menghasilkan riwayat dan potongan stok otomatis." icon={ReceiptText} /> : <div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Nomor transaksi</th><th>Status</th><th>Jenis produk</th><th>Total</th><th>Aksi</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>{formatDate(sale.completedAt)}</td><td><strong>{sale.receiptNumber}</strong></td><td><span className={`badge ${sale.status === "completed" ? "success" : "neutral"}`}>{statusLabel(sale.status)}</span>{sale.reversedAt && <small>{formatDate(sale.reversedAt)}</small>}</td><td>{sale.itemCount}</td><td>{formatCurrency(sale.total)}</td><td>{sale.status === "completed" ? <div className="reversal-actions"><input className="form-input" aria-label={`Alasan pembatalan ${sale.receiptNumber}`} value={reasonBySale[sale.id] || ""} onChange={(event) => setReasonBySale((current) => ({ ...current, [sale.id]: event.target.value }))} placeholder="Alasan (opsional)" /><button className="button ghost" disabled={reverse.isPending} onClick={() => reverse.mutate({ saleId: sale.id, type: "void", reason: reasonBySale[sale.id] || null })}>Void</button><button className="button secondary" disabled={reverse.isPending} onClick={() => reverse.mutate({ saleId: sale.id, type: "refund", reason: reasonBySale[sale.id] || null })}>Refund</button></div> : <small>{sale.reversalReason || "Stok telah dipulihkan."}</small>}</td></tr>)}</tbody></table></div>}</Panel>}</AppShell>;
}
