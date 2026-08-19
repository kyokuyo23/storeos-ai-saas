import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Boxes,
  Check,
  ChevronLeft,
  ClipboardList,
  Coffee,
  Download,
  FileBarChart,
  LayoutDashboard,
  Menu,
  PackageOpen,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStoreOS } from "@/contexts/StoreOSContext";
import type { CartLine } from "@/types/storeos";
import {
  answerStoreQuestion,
  buildMorningBrief,
  calculateSavings,
  csvForReport,
  formatQuantity,
  formatRupiah,
  getAlerts,
  getInventoryVariance,
  getPeriodMetrics,
  getProductMetrics,
  getStoreHealth,
  getTodayMetric,
  type AlertSeverity,
  type Ingredient,
  type MovementType,
  type PaymentMethod,
  type Product,
} from "@/lib/storeos";

type View = "dashboard" | "pos" | "products" | "inventory" | "sales" | "alerts" | "ask" | "reports" | "settings";
type Period = "today" | "7d" | "30d";

const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "POS", icon: ShoppingBag },
  { id: "products", label: "Produk", icon: PackageOpen },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "sales", label: "Sales", icon: BarChart3 },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "ask", label: "Ask StoreOS", icon: Bot },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const severityClass: Record<AlertSeverity, string> = {
  critical: "bg-red-50 text-red-700 border-red-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  info: "bg-blue-50 text-blue-700 border-blue-100",
};

const severityLabel: Record<AlertSeverity, string> = {
  critical: "Kritis",
  warning: "Peringatan",
  info: "Info",
};

function StatusPill({ label, tone = "green" }: { label: string; tone?: "green" | "amber" | "red" | "slate" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${styles[tone]}`}>{label}</span>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#17201d] sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#123a2c] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0d2e22] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

function SecondaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#dce6df] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-[#f6faf7] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

function PeriodTabs({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const options: Array<{ id: Period; label: string }> = [{ id: "today", label: "Hari ini" }, { id: "7d", label: "7 hari" }, { id: "30d", label: "30 hari" }];
  return <div className="flex w-fit rounded-xl bg-[#edf3ee] p-1">{options.map((option) => <button key={option.id} onClick={() => onChange(option.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === option.id ? "bg-white text-[#123a2c] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.label}</button>)}</div>;
}

function TrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : 6 + (index / (values.length - 1)) * 88;
    const y = 78 - ((value - min) / range) * 62;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="mt-5 overflow-hidden">
      <svg viewBox="0 0 100 100" className="h-48 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Trend omzet">
        {[20, 45, 70].map((y) => <line key={y} x1="4" x2="96" y1={y} y2={y} stroke="#e8efea" strokeWidth="0.6" strokeDasharray="2 2" />)}
        {values.length > 1 && <polygon points={`6,82 ${points} 94,82`} fill="#d8f2e2" opacity="0.8" />}
        <polyline points={points} fill="none" stroke="#197149" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.split(" ").map((point) => { const [x, y] = point.split(","); return <circle key={point} cx={x} cy={y} r="1.7" fill="white" stroke="#197149" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />; })}
      </svg>
      <div className="mt-1 grid text-[10px] font-medium text-slate-400" style={{ gridTemplateColumns: `repeat(${Math.min(labels.length, 7)}, minmax(0, 1fr))` }}>
        {labels.slice(labels.length > 7 ? -7 : 0).map((label) => <span key={label} className="text-center">{label}</span>)}
      </div>
    </div>
  );
}

function SmallBarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return <div className="mt-5 flex h-48 items-end gap-2 px-1">{values.map((value, index) => <div key={`${labels[index]}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="rounded-t-md bg-[#80d2a2] transition-all" style={{ height: `${Math.max(6, (value / max) * 100)}%` }} title={`${labels[index]}: ${formatRupiah(value)}`} /><span className="truncate text-center text-[10px] font-medium text-slate-400">{labels[index]}</span></div>)}</div>;
}

function Dashboard({ go }: { go: (view: View) => void }) {
  const { data } = useStoreOS();
  const [period, setPeriod] = useState<Period>("7d");
  const today = getTodayMetric(data);
  const health = getStoreHealth(data);
  const savings = calculateSavings(data);
  const brief = buildMorningBrief(data);
  const metrics = getPeriodMetrics(data, period);
  const products = getProductMetrics(data);
  const labels = metrics.map((metric) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(metric.date)));
  const kpis = [
    { label: "Omzet Hari Ini", value: formatRupiah(today.revenue), caption: "Pendapatan kotor", tone: "text-[#123a2c]" },
    { label: "Transaksi", value: today.transactions.toString(), caption: "Pembayaran selesai", tone: "text-[#267a52]" },
    { label: "Average Order Value", value: formatRupiah(today.revenue / today.transactions), caption: "Rata-rata per transaksi", tone: "text-[#c17521]" },
    { label: "Gross Profit", value: formatRupiah(today.grossProfit), caption: "Laba kotor hari ini", tone: "text-[#176ab0]" },
    { label: "Gross Margin", value: `${((today.grossProfit / today.revenue) * 100).toFixed(1)}%`, caption: "Efisiensi pendapatan", tone: "text-[#197149]" },
  ];
  return <>
    <PageHeading eyebrow="Kopi Nusantara · Cibitung Bekasi" title="Selamat pagi, pemilik toko." description="Prioritaskan tiga risiko operasional agar margin tetap terlindungi." action={<PrimaryButton onClick={() => go("pos")}><ShoppingBag size={16} />Buka POS</PrimaryButton>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{kpis.map((kpi) => <div key={kpi.label} className="store-card p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{kpi.label}</p><p className={`mt-3 text-2xl font-bold tracking-[-0.045em] ${kpi.tone}`}>{kpi.value}</p><p className="mt-2 text-xs font-medium text-slate-500">{kpi.caption}</p></div>)}</div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="store-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Analitik penjualan</p><h2 className="mt-1 text-lg font-bold tracking-[-0.03em]">Pergerakan omzet</h2><p className="mt-1 text-sm text-slate-500">Diperbarui dari transaksi dan data demo yang sama.</p></div><PeriodTabs period={period} onChange={setPeriod} /></div>
        <div className="mt-2 grid gap-5 lg:grid-cols-2"><TrendChart values={metrics.map((metric) => metric.revenue)} labels={labels} /><div className="rounded-xl border border-[#e8efea] bg-[#fbfdfb] px-4 pb-3"><p className="pt-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Gross profit per hari</p><SmallBarChart values={metrics.map((metric) => metric.grossProfit)} labels={labels} /></div></div>
      </div>
      <div className="store-card-dark p-5 text-white sm:p-6">
        <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200">Nilai yang dilindungi</p><h2 className="mt-2 text-xl font-bold tracking-[-0.03em]">Rp Diselamatkan StoreOS</h2></div><div className="rounded-xl bg-white/10 p-2.5"><Sparkles size={20} className="text-[#89ebad]" /></div></div>
        <p className="mt-5 text-3xl font-bold tracking-[-0.05em]">{formatRupiah(savings.total)}</p>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-xs"><span className="text-emerald-100/70">Waste <b className="float-right ml-2 text-white">{formatRupiah(savings.waste)}</b></span><span className="text-emerald-100/70">Varians <b className="float-right ml-2 text-white">{formatRupiah(savings.variance)}</b></span><span className="text-emerald-100/70">Anomali <b className="float-right ml-2 text-white">{formatRupiah(savings.anomaly)}</b></span><span className="text-emerald-100/70">Pembelian <b className="float-right ml-2 text-white">{formatRupiah(savings.purchasing)}</b></span></div>
      </div>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="store-card p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Business health</p><h2 className="mt-1 text-lg font-bold">Store Health Score</h2></div><StatusPill label={health.score >= 80 ? "Sehat" : "Perlu perhatian"} tone={health.score >= 80 ? "green" : "amber"} /></div><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-[10px] border-[#b9e9d2] bg-[#f5fbf7]"><div className="text-center"><p className="text-3xl font-bold tracking-[-0.06em] text-[#123a2c]">{health.score}</p><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">/ 100</p></div></div><div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3">{Object.entries({ Sales: health.sales, Margin: health.margin, Inventory: health.inventory, Waste: health.waste, Operasional: health.operations }).map(([label, value]) => <div key={label}><div className="flex justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{value}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2f9f68]" style={{ width: `${value}%` }} /></div></div>)}</div></div></div>
      <div className="store-card p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#e7f7ed] p-2.5 text-[#197149]"><Sparkles size={18} /></div><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">AI Morning Brief</p><h2 className="mt-1 text-lg font-bold">Yang perlu ditindaklanjuti</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{brief.summary}</p><div className="mt-4 space-y-2.5">{brief.alerts.map((alert) => <button key={alert.id} onClick={() => go("alerts")} className="flex w-full items-start gap-2 rounded-xl bg-[#f6faf7] p-3 text-left transition hover:bg-[#eef8f1]"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`} /><span><span className="block text-xs font-bold text-slate-700">{alert.title}</span><span className="mt-0.5 block text-xs text-slate-500">{alert.action}</span></span></button>)}</div><button onClick={() => go("ask")} className="mt-4 text-sm font-bold text-[#197149] hover:underline">Tanya lebih lanjut ke StoreOS →</button></div>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <RankingTable title="Performa Produk Hari Ini" products={products.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 5)} />
      <div className="store-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Aksi cepat</p><h2 className="mt-1 text-lg font-bold">Operasional hari ini</h2></div><ClipboardList size={20} className="text-slate-400" /></div><div className="mt-5 space-y-2">{["Catat pembelian bahan", "Lakukan stock opname", "Review shift malam"].map((action, index) => <button key={action} onClick={() => go(index === 2 ? "alerts" : "inventory")} className="flex w-full items-center justify-between rounded-xl border border-[#e2eae4] px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:border-[#b9e9d2] hover:bg-[#f6faf7]"><span>{action}</span><ChevronLeft size={16} className="rotate-180 text-slate-400" /></button>)}</div></div>
    </div>
  </>;
}

function RankingTable({ title, products }: { title: string; products: ReturnType<typeof getProductMetrics> }) {
  return <div className="store-card overflow-hidden"><div className="flex items-center justify-between p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ranking</p><h2 className="mt-1 text-lg font-bold">{title}</h2></div><BarChart3 size={20} className="text-slate-400" /></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead className="border-y border-[#edf2ee] bg-[#fbfdfb] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-5 py-3">Produk</th><th className="px-5 py-3">Terjual</th><th className="px-5 py-3">Omzet</th><th className="px-5 py-3">Gross profit</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.id} className="table-row-hover border-b border-[#edf2ee] last:border-0"><td className="px-5 py-3.5"><span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-md bg-[#edf5ef] text-[10px] font-bold text-[#197149]">{index + 1}</span><span className="text-sm font-bold text-slate-700">{product.name}</span></td><td className="px-5 py-3.5 text-sm text-slate-500">{product.soldToday} {product.unit}</td><td className="px-5 py-3.5 font-mono text-sm font-medium text-slate-700">{formatRupiah(product.revenue)}</td><td className="px-5 py-3.5 font-mono text-sm font-medium text-[#197149]">{formatRupiah(product.grossProfit)}</td></tr>)}</tbody></table></div></div>;
}

function Sales() {
  const { data } = useStoreOS();
  const [period, setPeriod] = useState<Period>("7d");
  const metrics = getPeriodMetrics(data, period);
  const labels = metrics.map((metric) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(metric.date)));
  const productMetrics = getProductMetrics(data);
  const sorters = [
    { label: "Top selling", rows: productMetrics.slice().sort((a, b) => b.soldToday - a.soldToday) },
    { label: "Lowest selling", rows: productMetrics.slice().sort((a, b) => a.soldToday - b.soldToday) },
    { label: "Highest revenue", rows: productMetrics.slice().sort((a, b) => b.revenue - a.revenue) },
    { label: "Highest profit", rows: productMetrics.slice().sort((a, b) => b.grossProfit - a.grossProfit) },
  ];
  return <><PageHeading eyebrow="Analitik penjualan" title="Sales" description="Baca arah pendapatan dan performa produk dari data transaksi yang sama." action={<PeriodTabs period={period} onChange={setPeriod} />} /><div className="grid gap-4 xl:grid-cols-2"><div className="store-card p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Line chart</p><h2 className="mt-1 text-lg font-bold">Omzet</h2><TrendChart values={metrics.map((metric) => metric.revenue)} labels={labels} /></div><div className="store-card p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Bar chart</p><h2 className="mt-1 text-lg font-bold">Gross profit</h2><SmallBarChart values={metrics.map((metric) => metric.grossProfit)} labels={labels} /></div></div><div className="mt-4 grid gap-4 md:grid-cols-2">{sorters.map((section) => <RankingTable key={section.label} title={section.label} products={section.rows.slice(0, 5)} />)}</div></>;
}

function POS() {
  const { data, completeSale } = useStoreOS();
  const [category, setCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("QRIS");
  const [receipt, setReceipt] = useState<{ id: string; total: number; grossProfit: number; lines: CartLine[]; payment: PaymentMethod } | null>(null);
  const products = data.products.filter((product) => product.status === "Aktif" && (category === "Semua" || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase()));
  const addProduct = (product: Product) => setCart((current) => current.some((line) => line.product.id === product.id) ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1, discount: 0 }]);
  const updateLine = (id: string, patch: Partial<CartLine>) => setCart((current) => current.map((line) => line.product.id === id ? { ...line, ...patch } : line).filter((line) => line.quantity > 0));
  const total = cart.reduce((sum, line) => sum + Math.max(0, line.product.sellingPrice * line.quantity - line.discount), 0);
  const checkout = () => {
    if (!cart.length) return toast.error("Tambahkan produk ke keranjang terlebih dahulu.");
    const completed = completeSale(cart, payment);
    setReceipt({ ...completed, lines: cart, payment });
    setCart([]);
    toast.success("Transaksi berhasil diselesaikan dan stok diperbarui.");
  };
  return <><PageHeading eyebrow="Kasir" title="Point of Sale" description="Transaksi selesai akan langsung memperbarui penjualan, stok, dan audit operasional." /><div className="grid gap-4 xl:grid-cols-[1fr_390px]"><div className="store-card p-4 sm:p-5"><div className="flex flex-col gap-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk..." className="w-full rounded-xl border border-[#dce6df] bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#5db784] focus:ring-4 focus:ring-[#e6f6ed]" /></div><div className="flex gap-2 overflow-x-auto pb-1">{["Semua", ...data.categories].map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${category === item ? "bg-[#123a2c] text-white" : "bg-[#eff4f0] text-slate-600 hover:bg-[#e2ece4]"}`}>{item}</button>)}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <button key={product.id} onClick={() => addProduct(product)} className="group rounded-2xl border border-[#e3ebe5] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#a9dcbf] hover:shadow-lg hover:shadow-[#21533a]/5 active:scale-[0.98]"><div className="flex items-start justify-between"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f7ee] text-[#197149]"><Coffee size={18} /></div><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{product.category}</span></div><h3 className="mt-5 text-sm font-bold text-slate-800">{product.name}</h3><p className="mt-1 font-mono text-sm font-bold text-[#197149]">{formatRupiah(product.sellingPrice)}</p><p className="mt-3 text-[11px] text-slate-400">Stok produk: {product.stock} {product.unit}</p></button>)}</div></div><div className="store-card flex min-h-[620px] flex-col overflow-hidden"><div className="border-b border-[#e7eee8] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Pesanan aktif</p><h2 className="mt-1 text-lg font-bold">Keranjang</h2></div><button onClick={() => setCart([])} disabled={!cart.length} className="text-xs font-bold text-slate-400 hover:text-red-600 disabled:opacity-40">Kosongkan</button></div></div><div className="flex-1 space-y-3 overflow-auto p-4">{cart.length ? cart.map((line) => <div key={line.product.id} className="rounded-xl border border-[#e4ece6] p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold text-slate-700">{line.product.name}</p><p className="mt-0.5 font-mono text-xs text-[#197149]">{formatRupiah(line.product.sellingPrice)}</p></div><button onClick={() => updateLine(line.product.id, { quantity: 0 })} className="text-slate-400 hover:text-red-600"><X size={16} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center rounded-lg border border-[#e0e9e2]"><button onClick={() => updateLine(line.product.id, { quantity: line.quantity - 1 })} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-50">−</button><span className="min-w-8 text-center text-xs font-bold">{line.quantity}</span><button onClick={() => updateLine(line.product.id, { quantity: line.quantity + 1 })} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-50">+</button></div><p className="font-mono text-sm font-bold">{formatRupiah(line.product.sellingPrice * line.quantity - line.discount)}</p></div><label className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-slate-400">Diskon (Rp)<input type="number" min="0" value={line.discount || ""} onChange={(event) => updateLine(line.product.id, { discount: Math.max(0, Number(event.target.value)) })} className="ml-2 w-24 rounded-lg border border-[#e0e9e2] px-2 py-1 text-right text-xs text-slate-700 outline-none focus:border-[#5db784]" placeholder="0" /></label></div>) : <div className="grid h-full place-items-center py-20 text-center"><div><ShoppingBag className="mx-auto text-slate-300" size={34} /><p className="mt-3 text-sm font-bold text-slate-500">Keranjang masih kosong</p><p className="mt-1 text-xs text-slate-400">Pilih produk dari panel sebelah kiri.</p></div></div>}</div><div className="border-t border-[#e7eee8] bg-[#fbfdfb] p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Metode pembayaran</p><div className="mt-2 grid grid-cols-3 gap-2">{(["Cash", "QRIS", "Transfer", "Debit", "Other"] as PaymentMethod[]).map((method) => <button key={method} onClick={() => setPayment(method)} className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${payment === method ? "border-[#197149] bg-[#e9f7ee] text-[#197149]" : "border-[#e1e9e3] bg-white text-slate-500 hover:bg-slate-50"}`}>{method}</button>)}</div><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-slate-500">Total pembayaran</p><p className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#123a2c]">{formatRupiah(total)}</p></div><PrimaryButton onClick={checkout} disabled={!cart.length}><Check size={16} />Bayar</PrimaryButton></div></div></div></div>{receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}</>;
}

function ReceiptModal({ receipt, close }: { receipt: { id: string; total: number; grossProfit: number; lines: CartLine[]; payment: PaymentMethod }; close: () => void }) {
  const { data } = useStoreOS();
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#10251b]/45 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl soft-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Transaksi selesai</p><h2 className="mt-1 text-xl font-bold">Receipt</h2></div><button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 rounded-xl bg-[#f4f8f5] p-4 text-sm"><div className="flex justify-between"><span className="font-bold text-slate-700">{data.business.name}</span><span className="font-mono text-xs text-slate-400">{receipt.id}</span></div><p className="mt-1 text-xs text-slate-500">{data.business.location}</p><div className="my-4 border-t border-dashed border-slate-300" />{receipt.lines.map((line) => <div className="mb-2 flex justify-between text-xs text-slate-600" key={line.product.id}><span>{line.product.name} × {line.quantity}</span><span className="font-mono">{formatRupiah(line.product.sellingPrice * line.quantity - line.discount)}</span></div>)}<div className="my-4 border-t border-dashed border-slate-300" /><div className="flex justify-between"><span className="font-bold">Total</span><span className="font-mono text-lg font-bold text-[#123a2c]">{formatRupiah(receipt.total)}</span></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Pembayaran</span><span>{receipt.payment}</span></div></div><p className="mt-4 text-center text-xs text-slate-400">Stok, penjualan, laporan, dan audit telah diperbarui dari satu sumber data.</p><PrimaryButton onClick={close} className="mt-5 w-full">Selesai</PrimaryButton></div></div>;
}

function Products() {
  const { data, upsertProduct, deleteProduct } = useStoreOS();
  const [editor, setEditor] = useState<Product | "new" | null>(null);
  const productMetrics = getProductMetrics(data);
  return <><PageHeading eyebrow="Katalog & resep" title="Produk" description="Kelola harga, COGS, stok produk, dan komposisi bahan untuk perhitungan theoretical usage." action={<PrimaryButton onClick={() => setEditor("new")}><Plus size={16} />Tambah produk</PrimaryButton>} />{editor && <ProductEditor key={editor === "new" ? "new" : editor.id} initial={editor === "new" ? undefined : editor} ingredients={data.ingredients} categories={data.categories} onCancel={() => setEditor(null)} onSave={(product) => { upsertProduct(product); setEditor(null); toast.success("Produk tersimpan."); }} />}<div className="store-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left"><thead className="border-b border-[#e7eee8] bg-[#fbfdfb] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-5 py-3">Produk</th><th className="px-5 py-3">Harga jual</th><th className="px-5 py-3">COGS</th><th className="px-5 py-3">Gross profit</th><th className="px-5 py-3">Margin</th><th className="px-5 py-3">Stok</th><th className="px-5 py-3">Resep</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{productMetrics.map((product) => <tr key={product.id} className="table-row-hover border-b border-[#edf2ee] last:border-0"><td className="px-5 py-4"><p className="text-sm font-bold text-slate-700">{product.name}</p><p className="mt-0.5 text-xs text-slate-400">{product.category} · {product.status}</p></td><td className="px-5 py-4 font-mono text-sm">{formatRupiah(product.sellingPrice)}</td><td className="px-5 py-4 font-mono text-sm text-slate-500">{formatRupiah(product.cogs)}</td><td className="px-5 py-4 font-mono text-sm font-bold text-[#197149]">{formatRupiah(product.sellingPrice - product.cogs)}</td><td className="px-5 py-4"><StatusPill label={`${product.margin.toFixed(1)}%`} tone={product.margin >= 40 ? "green" : "amber"} /></td><td className="px-5 py-4 text-sm text-slate-600">{product.stock} / min. {product.minimumStock} {product.unit}</td><td className="px-5 py-4 text-xs text-slate-500">{product.recipe.length} bahan</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button aria-label={`Edit ${product.name}`} onClick={() => setEditor(product)} className="rounded-lg p-2 text-slate-400 hover:bg-[#edf6ef] hover:text-[#197149]"><Pencil size={16} /></button><button aria-label={`Hapus ${product.name}`} onClick={() => { if (confirm(`Hapus ${product.name}?`)) { deleteProduct(product.id); toast.success("Produk dihapus."); } }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div></div></>;
}

function ProductEditor({ initial, ingredients, categories, onCancel, onSave }: { initial?: Product; ingredients: Ingredient[]; categories: string[]; onCancel: () => void; onSave: (product: Product) => void }) {
  const [draft, setDraft] = useState<Product>(() => initial ?? { id: `PRD-${Date.now().toString(36)}`, name: "", category: categories[0] ?? "Kopi", sellingPrice: 0, cogs: 0, stock: 0, minimumStock: 0, unit: "gelas", status: "Aktif", soldToday: 0, recipe: [] });
  const update = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!draft.name.trim()) return toast.error("Nama produk wajib diisi."); onSave({ ...draft, name: draft.name.trim() }); };
  return <form onSubmit={submit} className="store-card mb-4 p-5 sm:p-6 soft-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Product editor</p><h2 className="mt-1 text-lg font-bold">{initial ? `Edit ${initial.name}` : "Tambah produk baru"}</h2></div><button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><FormField label="Nama produk"><input value={draft.name} onChange={(event) => update("name", event.target.value)} className="form-input" placeholder="Contoh: Kopi Gula Aren" /></FormField><FormField label="Kategori"><select value={draft.category} onChange={(event) => update("category", event.target.value)} className="form-input">{categories.map((category) => <option key={category}>{category}</option>)}</select></FormField><FormField label="Harga jual"><input type="number" min="0" value={draft.sellingPrice || ""} onChange={(event) => update("sellingPrice", Number(event.target.value))} className="form-input" /></FormField><FormField label="COGS"><input type="number" min="0" value={draft.cogs || ""} onChange={(event) => update("cogs", Number(event.target.value))} className="form-input" /></FormField><FormField label="Stok produk"><input type="number" min="0" value={draft.stock || ""} onChange={(event) => update("stock", Number(event.target.value))} className="form-input" /></FormField><FormField label="Stok minimum"><input type="number" min="0" value={draft.minimumStock || ""} onChange={(event) => update("minimumStock", Number(event.target.value))} className="form-input" /></FormField><FormField label="Satuan"><input value={draft.unit} onChange={(event) => update("unit", event.target.value)} className="form-input" /></FormField><FormField label="Status"><select value={draft.status} onChange={(event) => update("status", event.target.value as Product["status"])} className="form-input"><option>Aktif</option><option>Nonaktif</option></select></FormField></div><div className="mt-5 rounded-xl bg-[#f6faf7] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">Recipe system</p><p className="mt-0.5 text-xs text-slate-500">Komposisi ini menentukan pemakaian bahan teoritis ketika produk terjual.</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, recipe: [...current.recipe, { ingredientId: ingredients[0]?.id ?? "", quantity: 0 }] }))} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#197149] ring-1 ring-[#dce6df] hover:bg-[#edf8f0]"><Plus size={14} className="mr-1 inline" />Tambah bahan</button></div>{draft.recipe.length ? <div className="mt-4 space-y-2">{draft.recipe.map((recipe, index) => <div key={`${recipe.ingredientId}-${index}`} className="grid grid-cols-[1fr_110px_32px] gap-2"><select value={recipe.ingredientId} onChange={(event) => setDraft((current) => ({ ...current, recipe: current.recipe.map((item, itemIndex) => itemIndex === index ? { ...item, ingredientId: event.target.value } : item) }))} className="form-input">{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select><input type="number" min="0" step="0.001" value={recipe.quantity || ""} onChange={(event) => setDraft((current) => ({ ...current, recipe: current.recipe.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item) }))} className="form-input" placeholder="Jumlah" /><button type="button" onClick={() => setDraft((current) => ({ ...current, recipe: current.recipe.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div>)}</div> : <p className="mt-3 text-xs text-slate-400">Tambahkan bahan untuk mengaktifkan kalkulasi theoretical usage.</p>}</div><div className="mt-5 flex flex-col gap-3 border-t border-[#e8efea] pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-500">Gross profit <b className="ml-1 text-[#197149]">{formatRupiah(Math.max(0, draft.sellingPrice - draft.cogs))}</b> · Margin <b className="ml-1 text-[#197149]">{draft.sellingPrice ? (((draft.sellingPrice - draft.cogs) / draft.sellingPrice) * 100).toFixed(1) : "0.0"}%</b></div><div className="flex gap-2"><SecondaryButton type="button" onClick={onCancel}>Batal</SecondaryButton><PrimaryButton type="submit"><Check size={16} />Simpan produk</PrimaryButton></div></div></form>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-slate-600"><span className="mb-1.5 block">{label}</span>{children}</label>; }

function Inventory() {
  const { data, recordMovement } = useStoreOS();
  const [showMovement, setShowMovement] = useState(false);
  const variance = getInventoryVariance(data);
  return <><PageHeading eyebrow="Bahan baku & varians" title="Inventory" description="Setiap perubahan stok dicatat sebagai movement; pemakaian aktual dibandingkan dengan resep dan penjualan." action={<PrimaryButton onClick={() => setShowMovement(true)}><Plus size={16} />Catat movement</PrimaryButton>} />{showMovement && <MovementEditor ingredients={data.ingredients} onClose={() => setShowMovement(false)} onSave={(movement) => { recordMovement(movement); setShowMovement(false); toast.success("Stock movement berhasil dicatat."); }} />}<div className="store-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left"><thead className="border-b border-[#e7eee8] bg-[#fbfdfb] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-5 py-3">Bahan</th><th className="px-5 py-3">Stok saat ini</th><th className="px-5 py-3">Status stok</th><th className="px-5 py-3">Biaya rata-rata</th><th className="px-5 py-3">Theoretical</th><th className="px-5 py-3">Aktual</th><th className="px-5 py-3">Varians</th><th className="px-5 py-3">Status varians</th></tr></thead><tbody>{variance.map((item) => { const lowStock = item.currentStock <= item.minStock; return <tr key={item.id} className="table-row-hover border-b border-[#edf2ee] last:border-0"><td className="px-5 py-4"><p className="text-sm font-bold text-slate-700">{item.name}</p><p className="mt-0.5 text-xs text-slate-400">Minimum {formatQuantity(item.minStock)} {item.unit}</p></td><td className="px-5 py-4 text-sm text-slate-700">{formatQuantity(item.currentStock)} {item.unit}</td><td className="px-5 py-4"><StatusPill label={lowStock ? "Stok rendah" : "Aman"} tone={lowStock ? "red" : "green"} /></td><td className="px-5 py-4 font-mono text-sm text-slate-500">{formatRupiah(item.averageCost)} / {item.unit}</td><td className="px-5 py-4 text-sm text-slate-500">{formatQuantity(item.theoreticalUsage)} {item.unit}</td><td className="px-5 py-4 text-sm text-slate-600">{formatQuantity(item.actualUsage)} {item.unit}</td><td className="px-5 py-4 font-mono text-sm font-bold text-red-600">{item.variance > 0 ? "+" : ""}{formatQuantity(item.variance)} {item.unit}</td><td className="px-5 py-4"><StatusPill label={item.status} tone={item.status === "Sehat" ? "green" : item.status === "Kritis" ? "red" : "amber"} /></td></tr>; })}</tbody></table></div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><MovementList /><div className="store-card p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Cara kerja</p><h2 className="mt-1 text-lg font-bold">Theoretical vs actual stock</h2><p className="mt-3 text-sm leading-6 text-slate-600">StoreOS menghitung kebutuhan bahan dari komposisi resep × unit yang terjual. Angka tersebut dibandingkan dengan movement Sale aktual, lalu selisihnya dibaca sebagai varians yang perlu ditelusuri.</p><div className="mt-4 rounded-xl bg-[#f6faf7] p-4 text-xs leading-5 text-slate-600"><b className="text-[#197149]">Catatan demo:</b> Varians susu muncul dari movement Sale yang melebihi kebutuhan resep. Setelah stock opname atau koreksi dicatat, alert dan saving breakdown akan ikut dihitung ulang.</div></div></div></>;
}

function MovementEditor({ ingredients, onClose, onSave }: { ingredients: Ingredient[]; onClose: () => void; onSave: (value: { ingredientId: string; type: MovementType; quantity: number; note: string }) => void }) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const [type, setType] = useState<MovementType>("Purchase");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  return <div className="store-card mb-4 p-5 soft-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Inventory ledger</p><h2 className="mt-1 text-lg font-bold">Catat stock movement</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField label="Bahan"><select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} className="form-input">{ingredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField><FormField label="Tipe movement"><select value={type} onChange={(event) => setType(event.target.value as MovementType)} className="form-input">{(["Purchase", "Sale", "Waste", "Adjustment", "Stock Opname"] as MovementType[]).map((item) => <option key={item}>{item}</option>)}</select></FormField><FormField label="Jumlah"><input type="number" step="0.01" min="0" value={quantity || ""} onChange={(event) => setQuantity(Number(event.target.value))} className="form-input" /></FormField><FormField label="Keterangan"><input value={note} onChange={(event) => setNote(event.target.value)} className="form-input" placeholder="Alasan perubahan stok" /></FormField></div><div className="mt-5 flex justify-end gap-2"><SecondaryButton onClick={onClose}>Batal</SecondaryButton><PrimaryButton onClick={() => { if (quantity <= 0) return toast.error("Jumlah harus lebih dari 0."); onSave({ ingredientId, type, quantity, note }); }}><Check size={16} />Simpan movement</PrimaryButton></div></div>;
}

function MovementList() { const { data } = useStoreOS(); return <div className="store-card overflow-hidden"><div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ledger terbaru</p><h2 className="mt-1 text-lg font-bold">Stock movement</h2></div><div className="border-t border-[#edf2ee]">{data.movements.slice(0, 6).map((movement) => { const ingredient = data.ingredients.find((item) => item.id === movement.ingredientId); const outbound = movement.type === "Sale" || movement.type === "Waste"; return <div key={movement.id} className="flex items-center justify-between gap-4 border-b border-[#edf2ee] px-5 py-3.5 last:border-0"><div><p className="text-sm font-bold text-slate-700">{ingredient?.name}</p><p className="mt-0.5 text-xs text-slate-400">{movement.type} · {movement.note}</p></div><span className={`font-mono text-sm font-bold ${outbound ? "text-red-600" : "text-[#197149]"}`}>{outbound ? "−" : "+"}{formatQuantity(movement.quantity)} {ingredient?.unit}</span></div>; })}</div></div>; }

function Alerts() { const { data } = useStoreOS(); const alerts = getAlerts(data); return <><PageHeading eyebrow="Pusat risiko" title="Alerts" description="Peringatan otomatis dari stok, varians, waste, dan pola transaksi pada data operasional." action={<StatusPill label={`${alerts.length} alert aktif`} tone={alerts.some((alert) => alert.severity === "critical") ? "red" : "amber"} />} /><div className="space-y-3">{alerts.map((alert) => <div key={alert.id} className="store-card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${alert.severity === "critical" ? "bg-red-500 shadow-[0_0_0_5px_rgba(239,68,68,0.1)]" : "bg-amber-500 shadow-[0_0_0_5px_rgba(245,158,11,0.1)]"}`} /><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${severityClass[alert.severity]}`}>{severityLabel[alert.severity]} · {alert.category}</span><span className="text-xs font-medium text-slate-400">Potensi dampak {formatRupiah(alert.impact)}</span></div><h2 className="mt-3 text-base font-bold text-slate-800">{alert.title}</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">{alert.description}</p><p className="mt-3 text-sm font-bold text-[#197149]">Rekomendasi: {alert.action}</p></div></div><button onClick={() => toast.message("Alert ditandai untuk ditinjau.")} className="shrink-0 rounded-lg border border-[#dce6df] px-3 py-2 text-xs font-bold text-slate-600 hover:bg-[#f6faf7]">Tandai ditinjau</button></div>)}</div></>; }

function AskStoreOS() {
  const { data } = useStoreOS();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{ role: "assistant", content: "Saya membaca data Kopi Nusantara yang aktif saat ini. Tanyakan tentang omzet, profit, stok, produk, waste, atau risiko operasional." }]);
  const suggestions = ["Kenapa omzet saya naik?", "Produk paling untung apa?", "Stok apa yang harus saya beli?", "Apakah ada indikasi pemborosan?"];
  const submit = (value = question) => { const trimmed = value.trim(); if (!trimmed) return; setMessages((current) => [...current, { role: "user", content: trimmed }, { role: "assistant", content: answerStoreQuestion(data, trimmed) }]); setQuestion(""); };
  return <><PageHeading eyebrow="Deterministic insight engine" title="Ask StoreOS" description="Jawaban dibangun dari snapshot data yang sedang aktif, bukan dari percakapan atau angka yang dihardcode." /><div className="grid gap-4 xl:grid-cols-[1fr_320px]"><div className="store-card flex min-h-[570px] flex-col overflow-hidden"><div className="border-b border-[#edf2ee] bg-[#fbfdfb] p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f7ee] text-[#197149]"><Bot size={20} /></div><div><p className="font-bold text-slate-800">StoreOS Intelligence</p><p className="text-xs text-slate-400">Live data context · Kopi Nusantara</p></div></div></div><div className="flex-1 space-y-4 overflow-auto p-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#123a2c] text-white" : "bg-[#f0f5f1] text-slate-700"}`}><RichText text={message.content} /></div></div>)}</div><form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex gap-2 border-t border-[#edf2ee] p-4"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Tanyakan kondisi toko Anda..." className="form-input flex-1" /><PrimaryButton type="submit" disabled={!question.trim()}>Kirim</PrimaryButton></form></div><div className="space-y-4"><div className="store-card p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Contoh pertanyaan</p><div className="mt-4 flex flex-col gap-2">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => submit(suggestion)} className="rounded-xl border border-[#e1eae3] px-3 py-3 text-left text-sm font-bold text-slate-600 transition hover:border-[#b6e3c8] hover:bg-[#f6faf7]">{suggestion}</button>)}</div></div><div className="rounded-2xl bg-[#e9f7ee] p-5"><p className="text-sm font-bold text-[#135e3a]">Siap untuk LLM</p><p className="mt-2 text-xs leading-5 text-[#397152]">Fungsi <code>answerStoreQuestion()</code> adalah abstraction layer saat ini. Ia dapat diganti dengan adapter LLM di masa depan tanpa mengubah sumber data transaksi, inventory, atau insight.</p></div></div></div></>;
}

function RichText({ text }: { text: string }) { const chunks = text.split(/(\*\*[^*]+\*\*)/g); return <>{chunks.map((chunk, index) => chunk.startsWith("**") ? <strong key={index}>{chunk.slice(2, -2)}</strong> : <span key={index}>{chunk}</span>)}</>; }

function Reports() { const { data } = useStoreOS(); const cards: Array<{ id: "sales" | "inventory" | "waste"; title: string; description: string; icon: typeof BarChart3 }> = [{ id: "sales", title: "Sales summary", description: "Produk, unit terjual, omzet, gross profit, dan margin.", icon: BarChart3 }, { id: "inventory", title: "Inventory summary", description: "Stok bahan, minimum stock, biaya rata-rata, dan status.", icon: Boxes }, { id: "waste", title: "Waste summary", description: "Bahan yang terbuang, jumlah, nilai, dan keterangan.", icon: AlertTriangle }]; const download = (kind: "sales" | "inventory" | "waste") => { const blob = new Blob([csvForReport(data, kind)], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `storeos-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url); toast.success("Laporan CSV diunduh."); }; return <><PageHeading eyebrow="Export operasional" title="Reports" description="Unduh ringkasan CSV yang dibuat dari data StoreOS saat ini." /><div className="grid gap-4 md:grid-cols-3">{cards.map((card) => <div key={card.id} className="store-card p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f7ee] text-[#197149]"><card.icon size={20} /></div><h2 className="mt-5 text-lg font-bold">{card.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{card.description}</p><SecondaryButton onClick={() => download(card.id)} className="mt-5 w-full"><Download size={16} />Unduh CSV</SecondaryButton></div>)}</div><div className="store-card mt-4 overflow-hidden"><div className="p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Transaksi terbaru</p><h2 className="mt-1 text-lg font-bold">Receipt register</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="border-y border-[#edf2ee] bg-[#fbfdfb] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Waktu</th><th className="px-5 py-3">Pembayaran</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Profit</th></tr></thead><tbody>{data.transactions.slice(0, 8).map((sale) => <tr key={sale.id} className="table-row-hover border-b border-[#edf2ee] last:border-0"><td className="px-5 py-3.5 font-mono text-sm font-bold text-slate-700">{sale.id}</td><td className="px-5 py-3.5 text-sm text-slate-500">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.createdAt))}</td><td className="px-5 py-3.5"><StatusPill label={sale.paymentMethod} tone="slate" /></td><td className="px-5 py-3.5 font-mono text-sm font-bold">{formatRupiah(sale.total)}</td><td className="px-5 py-3.5 font-mono text-sm font-bold text-[#197149]">{formatRupiah(sale.grossProfit)}</td></tr>)}</tbody></table></div></div></>;
}

function Settings() { const { data, updateBusiness } = useStoreOS(); const [draft, setDraft] = useState(data.business); const save = (event: React.FormEvent) => { event.preventDefault(); updateBusiness(draft); toast.success("Business profile diperbarui."); }; return <><PageHeading eyebrow="Konfigurasi bisnis" title="Settings" description="Profil ini digunakan pada dashboard, POS receipt, dan laporan." /><form onSubmit={save} className="store-card max-w-2xl p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f7ee] text-[#197149]"><Settings2 size={20} /></div><div><h2 className="font-bold">Business profile</h2><p className="text-xs text-slate-400">Identitas satu bisnis dan satu cabang MVP.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><FormField label="Nama bisnis"><input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="form-input" /></FormField><FormField label="Lokasi"><input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} className="form-input" /></FormField><FormField label="Konteks mata uang"><select value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))} className="form-input"><option>IDR (Rp)</option><option>USD ($)</option></select></FormField></div><div className="mt-6 flex justify-end border-t border-[#edf2ee] pt-4"><PrimaryButton type="submit"><Check size={16} />Simpan perubahan</PrimaryButton></div></form><div className="mt-4 max-w-2xl rounded-2xl bg-[#f1f5f2] p-5 text-sm leading-6 text-slate-500"><b className="text-slate-700">MVP deployment note.</b> Aplikasi ini sengaja tidak menampilkan login, multi-tenancy, subscription, ataupun billing. Semua modul dibuka langsung untuk satu profil bisnis, sesuai lingkup validasi StoreOS MVP.</div></>;
}

export default function Home() {
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return navigation.some((item) => item.id === requested) ? requested as View : "dashboard";
  });
  const [mobileMenu, setMobileMenu] = useState(false);
  const { data } = useStoreOS();
  const viewContent: Record<View, React.ReactNode> = { dashboard: <Dashboard go={setView} />, pos: <POS />, products: <Products />, inventory: <Inventory />, sales: <Sales />, alerts: <Alerts />, ask: <AskStoreOS />, reports: <Reports />, settings: <Settings /> };
  return <div className="min-h-screen bg-[#f3f5f2] text-[#17201d]"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col border-r border-[#e1e9e3] bg-white px-3 py-5 lg:flex"><Brand businessName={data.business.name} /><div className="mt-8 flex-1 space-y-1">{navigation.map((item) => <NavigationButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}</div><div className="rounded-2xl bg-[#edf7f0] p-3"><p className="text-xs font-bold text-[#197149]">Demo workspace</p><p className="mt-1 text-xs leading-5 text-[#518067]">Semua perubahan aktif selama sesi ini dan memengaruhi modul lain secara langsung.</p></div></aside><header className="sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-[#e1e9e3] bg-white/90 px-4 backdrop-blur lg:ml-[250px] lg:px-8"><button onClick={() => setMobileMenu(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button><div className="hidden lg:block"><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Store operations</p><p className="mt-0.5 text-sm font-bold text-slate-700">{navigation.find((item) => item.id === view)?.label}</p></div><div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-bold text-slate-700">{data.business.name}</p><p className="text-[11px] text-slate-400">{data.business.location}</p></div><div className="grid h-9 w-9 place-items-center rounded-full bg-[#123a2c] text-xs font-bold text-white">KN</div></div></header><main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:ml-[250px] lg:p-8">{viewContent[view]}</main>{mobileMenu && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Tutup menu" className="absolute inset-0 bg-[#10251b]/35" onClick={() => setMobileMenu(false)} /><aside className="relative flex h-full w-[280px] flex-col bg-white p-4 shadow-2xl soft-enter"><div className="flex items-center justify-between"><Brand businessName={data.business.name} compact /><button onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="mt-7 flex-1 space-y-1">{navigation.map((item) => <NavigationButton key={item.id} item={item} active={view === item.id} onClick={() => { setView(item.id); setMobileMenu(false); }} />)}</div></aside></div>}</div>;
}

function Brand({ businessName, compact = false }: { businessName: string; compact?: boolean }) { return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#123a2c] text-white shadow-lg shadow-[#123a2c]/15"><Coffee size={20} /></div>{!compact && <div><p className="font-bold tracking-[-0.04em] text-[#123a2c]">StoreOS</p><p className="text-[11px] font-medium text-slate-400">{businessName}</p></div>}</div>; }

function NavigationButton({ item, active, onClick }: { item: { id: View; label: string; icon: typeof LayoutDashboard }; active: boolean; onClick: () => void }) { const Icon = item.icon; return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${active ? "bg-[#e8f6ed] text-[#176a43]" : "text-slate-500 hover:bg-[#f6faf7] hover:text-slate-700"}`}><Icon size={18} strokeWidth={active ? 2.4 : 2} /><span>{item.label}</span>{item.id === "alerts" && <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />}</button>; }
