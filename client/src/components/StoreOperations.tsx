import { AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, CheckCircle2, Info, Minus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";
import "./store-operations.css";

const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
const wib = (value: Date | string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const Loading = () => <div className="loading-state"><span className="loading-dot" /> Memuat data…</div>;

type Severity = "critical" | "warning" | "info";
const SEVERITY: Record<Severity, { label: string; badge: string; Icon: typeof AlertTriangle }> = {
  critical: { label: "Kritis", badge: "danger", Icon: AlertTriangle },
  warning: { label: "Perlu perhatian", badge: "warning", Icon: BellRing },
  info: { label: "Info", badge: "neutral", Icon: Info },
};
const CATEGORY_LABEL: Record<string, string> = { stock: "Stok", menu: "Menu", opname: "Stock opname", variance: "Varians" };

type AlertItem = { id: string; severity: Severity; category: string; title: string; detail: string; href: string };

function AlertList({ alerts, limit }: { alerts: AlertItem[]; limit?: number }) {
  const shown = limit ? alerts.slice(0, limit) : alerts;
  return <ul className="store-alert-list">
    {shown.map((alert) => {
      const meta = SEVERITY[alert.severity];
      return <li key={alert.id} className={`store-alert store-alert-${alert.severity}`}>
        <meta.Icon size={18} aria-hidden="true" />
        <div>
          <div className="store-alert-heading"><strong>{alert.title}</strong><span className={`badge ${meta.badge}`}>{meta.label}</span><span className="badge neutral">{CATEGORY_LABEL[alert.category] ?? alert.category}</span></div>
          <p>{alert.detail}</p>
        </div>
        <Link href={alert.href} className="button secondary compact-button">Buka</Link>
      </li>;
    })}
  </ul>;
}

export function StoreAlertsPage() {
  const query = trpc.alerts.list.useQuery(undefined, { refetchInterval: 60_000 });
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const data = query.data;
  const alerts = (data?.alerts ?? []) as AlertItem[];
  const visible = filter === "all" ? alerts : alerts.filter((alert) => alert.severity === filter);
  return <AppShell active="alerts" eyebrow="Operasional" title="Alerts">
    <PageHeader eyebrow="OPERASIONAL" title="Alerts" description="Peringatan otomatis dari data toko: stok, menu yang tidak bisa dijual, stock opname, dan selisih stok. Diperbarui setiap menit." />
    {query.isLoading ? <Loading /> : query.isError || !data ? <ErrorState message="Alert belum dapat dimuat. Silakan coba lagi." /> : <>
      <div className="store-kpis" role="group" aria-label="Ringkasan alert">
        {(["critical", "warning", "info"] as const).map((severity) => <button key={severity} type="button" className={`store-kpi store-kpi-${severity} ${filter === severity ? "active" : ""}`} aria-pressed={filter === severity} onClick={() => setFilter(filter === severity ? "all" : severity)}>
          <span>{SEVERITY[severity].label}</span><strong>{data.counts[severity]}</strong>
        </button>)}
      </div>
      <Panel title={filter === "all" ? "Semua alert" : `Alert: ${SEVERITY[filter].label}`} description={`Dihitung ${wib(data.generatedAt)} WIB. Pilih kartu di atas untuk memfilter.`}>
        {visible.length === 0 ? <EmptyState title={alerts.length === 0 ? "Tidak ada alert." : "Tidak ada alert pada filter ini."} description={alerts.length === 0 ? "Stok, menu, opname, dan varians dalam kondisi normal." : "Pilih kartu lain atau klik lagi untuk menampilkan semua."} icon={CheckCircle2} /> : <AlertList alerts={visible} />}
      </Panel>
    </>}
  </AppShell>;
}

/** Compact alert panel for the dashboard. */
export function DashboardAlertsPanel() {
  const query = trpc.alerts.list.useQuery(undefined, { refetchInterval: 60_000 });
  const alerts = (query.data?.alerts ?? []) as AlertItem[];
  return <Panel title="Store Alerts" description="Peringatan operasional terbaru dari data toko.">
    {query.isLoading ? <Loading /> : query.isError ? <ErrorState message="Alert belum dapat dimuat." /> : alerts.length === 0 ? <EmptyState title="Tidak ada alert." description="Semua kondisi operasional normal." icon={CheckCircle2} /> : <>
      <AlertList alerts={alerts} limit={3} />
      <Link href="/alerts" className="button ghost store-see-all">Lihat semua {alerts.length} alert</Link>
    </>}
  </Panel>;
}

const TONE_ICON = { positive: ArrowUpRight, negative: ArrowDownRight, neutral: Minus } as const;

export function StoreInsightsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.insights.overview.useQuery({ days });
  const data = query.data;
  const change = (value: number | null, suffix: string) => value === null ? "tidak ada pembanding" : `${value > 0 ? "+" : ""}${number(value)}${suffix} vs periode sebelumnya`;
  return <AppShell active="insights" eyebrow="Analitik" title="Insights">
    <PageHeader eyebrow="ANALITIK" title="Insights" description="Temuan otomatis dari transaksi dan pergerakan stok yang tercatat. Semua angka dihitung dari data toko, bukan perkiraan." action={<div className="store-period" role="group" aria-label="Periode">{([7, 30, 90] as const).map((option) => <button key={option} type="button" className={`button ${days === option ? "primary" : "ghost"}`} aria-pressed={days === option} onClick={() => setDays(option)}>{option} hari</button>)}</div>} />
    {query.isLoading ? <Loading /> : query.isError || !data ? <ErrorState message="Insight belum dapat dimuat. Silakan coba lagi." /> : <>
      <div className="financial-summary store-insight-kpis">
        <div><span>Pendapatan</span><strong>{rupiah(data.kpis.revenue)}</strong><small>{change(data.kpis.revenueChange, "%")}</small></div>
        <div><span>Margin kotor</span><strong>{number(data.kpis.grossMargin)}%</strong><small>{change(data.kpis.marginChangePoints, " poin")}</small></div>
        <div><span>Transaksi</span><strong>{data.kpis.saleCount}</strong><small>Rata-rata {rupiah(data.kpis.averageTicket)} / transaksi</small></div>
      </div>
      <Panel title="Temuan utama" description={`${data.periods.current.startDate} s/d ${data.periods.current.endDate} dibanding ${data.periods.previous.startDate} s/d ${data.periods.previous.endDate} (WIB).`}>
        <ul className="store-findings">{data.findings.map((finding) => { const Icon = TONE_ICON[finding.tone]; return <li key={finding.id} className={`store-finding tone-${finding.tone}`}><Icon size={17} aria-hidden="true" /><div><strong>{finding.title}</strong><p>{finding.detail}</p></div></li>; })}</ul>
      </Panel>
      <div className="store-grid">
        <Panel title="Produk terlaris" description="Berdasarkan pendapatan bersih periode ini.">
          {data.topProducts.length === 0 ? <EmptyState title="Belum ada penjualan." description="Produk terlaris muncul setelah ada transaksi." icon={Sparkles} /> : <div className="table-wrap"><table className="store-table"><thead><tr><th>Produk</th><th>Terjual</th><th>Pendapatan</th><th>Margin</th></tr></thead><tbody>{data.topProducts.map((product) => <tr key={product.productId}><td><strong>{product.productName}</strong></td><td>{product.quantity}</td><td>{rupiah(product.revenue)}</td><td><span className={`badge ${product.grossMargin < data.thresholds.lowMarginPercent ? "warning" : "success"}`}>{number(product.grossMargin)}%</span></td></tr>)}</tbody></table></div>}
        </Panel>
        <Panel title="Ketahanan stok" description="Perkiraan berapa hari stok cukup, dari pemakaian resep rata-rata periode ini.">
          {data.stockCoverage.length === 0 ? <EmptyState title="Belum ada bahan." description="Tambahkan bahan di Inventory." icon={Sparkles} /> : <div className="table-wrap"><table className="store-table"><thead><tr><th>Bahan</th><th>Stok</th><th>Pakai / hari</th><th>Cukup untuk</th></tr></thead><tbody>{data.stockCoverage.map((row) => <tr key={row.ingredientId}><td><strong>{row.name}</strong></td><td>{number(row.currentStock)} {row.unit}</td><td>{number(row.avgDailyUse)} {row.unit}</td><td>{row.coverageDays === null ? <span className="badge neutral">Belum dipakai</span> : <span className={`badge ${row.coverageDays < data.thresholds.shortCoverageDays ? "danger" : "success"}`}>{number(row.coverageDays)} hari</span>}</td></tr>)}</tbody></table></div>}
        </Panel>
      </div>
      {(data.lowMarginProducts.length > 0 || data.unsoldProducts.length > 0) && <Panel title="Perlu ditinjau" description={`Produk bermargin di bawah ${data.thresholds.lowMarginPercent}% dan produk aktif yang tidak terjual pada periode ini.`}>
        <div className="store-review">
          {data.lowMarginProducts.map((product) => <span key={`m-${product.productId}`} className="badge warning">{product.productName} · margin {number(product.grossMargin)}%</span>)}
          {data.unsoldProducts.map((product) => <span key={`u-${product.productId}`} className="badge neutral">{product.productName} · tidak terjual</span>)}
        </div>
      </Panel>}
    </>}
  </AppShell>;
}
