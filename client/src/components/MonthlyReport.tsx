import { Download, FileText, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppShell, ErrorState, PageHeader, Panel } from "./FoundationShell";

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

export function MonthlyReport() {
  const initial = useMemo(currentJakarta, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const query = trpc.reports.monthlySummary.useQuery({ year, month });
  const report = query.data;
  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ["StoreOS Monthly Management Report", report.period.label], ["Periode mulai", report.period.startDate], ["Periode akhir", report.period.endDate], ["Timezone", report.period.timezone], [], ["Financial", "Nilai"],
      ["Gross Sales", report.financial.grossSales], ["Net Revenue", report.financial.netRevenue], ["COGS", report.financial.cogs], ["Gross Profit", report.financial.grossProfit], ["Gross Margin (%)", report.financial.grossMargin], ["Sales Transaction Count", report.financial.salesTransactionCount], ["Refund Value", report.financial.refundValue], ["Void Value", report.financial.voidValue], ["Exchange Impact", report.financial.exchangeImpact], [], ["Inventory", "Nilai"],
      ["Opening Stock", report.inventory.openingStock], ["Closing Stock", report.inventory.closingStock], ["Expected Stock", report.inventory.expectedStock], ["Actual Stock", report.inventory.actualStock], ["Total Variance", report.inventory.totalVariance], ["Out-of-Tolerance Item Count", report.inventory.outOfToleranceItemCount], ["High-Value Variance Count", report.inventory.highValueVarianceCount], ["Recurring High Variance Ingredient Count", report.inventory.recurringHighVarianceIngredientCount], ["Stock-Opname Session Count", report.inventory.stockOpnameSessionCount], ["Open Stock-Opname Follow-Up Count", report.inventory.openStockOpnameFollowUpCount],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `storeos-monthly-${report.period.year}-${String(report.period.month).padStart(2, "0")}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <AppShell active="reports" eyebrow="Management Reporting" title="Monthly Summary"><PageHeader eyebrow="MONTHLY REPORTING" title="Ringkasan Manajemen Bulanan" description="Financial Core dan Inventory Intelligence dalam satu laporan read-only berbasis kalender Jakarta/WIB." action={<div className="header-actions"><button className="button secondary" onClick={downloadCsv} disabled={!report}><Download size={16} /> CSV</button><button className="button ghost" onClick={() => window.print()} disabled={!report}><FileText size={16} /> PDF / Cetak</button></div>} />
    <Panel title="Periode laporan" description="Batas laporan memakai 00:00 WIB pada hari pertama sampai sebelum 00:00 WIB bulan berikutnya."><div className="form-grid report-period-controls"><label className="field"><span>Tahun</span><select className="form-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => initial.year - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="field"><span>Bulan</span><select className="form-input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label><div className="report-period-label"><span>Periode aktif</span><strong>{report?.period.label ?? `${months[month - 1]} ${year}`}</strong><small>{report?.period.startDate ?? "—"} s/d {report?.period.endDate ?? "—"} · Asia/Jakarta</small></div></div></Panel>
    {query.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat laporan bulanan…</div> : query.isError ? <ErrorState message="Laporan bulanan tidak dapat dimuat. Silakan coba lagi." /> : report ? <div className="monthly-report-grid"><Panel title="Financial Core" description="Nilai yang sudah mengikuti pembatalan, refund, dan exchange sesuai Financial Core."><div className="summary-grid"><Metric label="Gross Sales" value={currency(report.financial.grossSales)} /><Metric label="Net Revenue" value={currency(report.financial.netRevenue)} /><Metric label="COGS" value={currency(report.financial.cogs)} /><Metric label="Gross Profit" value={currency(report.financial.grossProfit)} /><Metric label="Gross Margin" value={`${number(report.financial.grossMargin)}%`} /><Metric label="Sales" value={number(report.financial.salesTransactionCount)} /><Metric label="Refund Value" value={currency(report.financial.refundValue)} /><Metric label="Void Value" value={currency(report.financial.voidValue)} /><Metric label="Exchange Impact" value={currency(report.financial.exchangeImpact)} /></div></Panel><Panel title="Inventory Intelligence" description="Rekonsiliasi memakai inventory ledger dan tolerance engine yang sudah ada."><div className="summary-grid"><Metric label="Opening Stock" value={number(report.inventory.openingStock)} /><Metric label="Expected Stock" value={number(report.inventory.expectedStock)} /><Metric label="Actual / Closing Stock" value={number(report.inventory.actualStock)} /><Metric label="Total Variance" value={number(report.inventory.totalVariance)} /><Metric label="Di luar toleransi" value={number(report.inventory.outOfToleranceItemCount)} /><Metric label="High-value variance" value={number(report.inventory.highValueVarianceCount)} /><Metric label="Varians tinggi berulang" value={number(report.inventory.recurringHighVarianceIngredientCount)} detail="2/3 atau 3/3 periode comparable" /><Metric label="Sesi stock-opname" value={number(report.inventory.stockOpnameSessionCount)} /><Metric label="Follow-up terbuka" value={number(report.inventory.openStockOpnameFollowUpCount)} /></div></Panel></div> : <Panel title="Tidak ada data" description="Belum ada data transaksi atau pergerakan untuk bulan Jakarta/WIB yang dipilih."><div className="empty-state">Belum ada data pada periode yang dipilih.</div></Panel>}
    <p className="settings-help"><RefreshCw size={14} /> Laporan ini bersifat read-only dan tidak mengubah penjualan, ledger, stock-opname, atau Financial Core.</p>
  </AppShell>;
}
