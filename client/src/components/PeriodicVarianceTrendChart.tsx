import React, { useMemo } from "react";
import { buildVarianceTrendBuckets, VarianceTrendSummary } from "../lib/varianceTrend";
// formatCurrency is defined inside Foundation.tsx or shared utils. Let's define a local currency formatter or import from shared.
const formatCurrency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

type PeriodicIntelligenceSnapshot = {
  startDate?: string;
  endDate?: string;
  summary?: {
    totalAbsoluteVarianceValue: number;
    totalExcessVarianceValue: number;
    okCount: number;
    ingredientCount: number;
  };
};

const formatSettlementRange = (startDate: string, endDate: string) => {
  const formatter = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${endDate}T00:00:00+07:00`);
  return startDate === endDate ? formatter.format(start) : `${formatter.format(start)} – ${formatter.format(end)}`;
};

export function PeriodicVarianceTrendChart({
  currentIntelligence,
  historicalIntelligences,
  currentRangeLabel,
}: {
  currentIntelligence: PeriodicIntelligenceSnapshot;
  historicalIntelligences: PeriodicIntelligenceSnapshot[];
  currentRangeLabel: string;
}) {
  const trend = useMemo(() => buildVarianceTrendBuckets(currentIntelligence, historicalIntelligences), [currentIntelligence, historicalIntelligences]);

  const maxAbs = Math.max(1, trend.maxAbsoluteValue);
  const chartHeight = 160;
  const chartWidth = Math.max(500, trend.buckets.length * 80);
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;

  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const points = useMemo(() => {
    if (!trend.buckets.length) return [];
    const step = trend.buckets.length === 1 ? usableWidth : usableWidth / (trend.buckets.length - 1);
    return trend.buckets.map((bucket, index) => {
      const x = paddingLeft + index * step;
      const y = paddingTop + usableHeight - (bucket.totalAbsoluteVarianceValue / maxAbs) * usableHeight;
      return { ...bucket, x, y };
    });
  }, [trend.buckets, usableWidth, usableHeight, maxAbs]);

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const directionLabel =
    trend.trendDirection === "increasing"
      ? "Menunjukkan tren kenaikan selisih varians"
      : trend.trendDirection === "decreasing"
      ? "Menunjukkan tren penurunan selisih varians"
      : "Cenderung stabil";

  return (
    <div className="card period-cost-comparison" style={{ marginTop: "1.5rem" }}>
      <div className="period-cost-comparison-heading">
        <div>
          <span>Grafik Tren Varians Periodik</span>
          <strong>Ringkasan Nilai Selisih Absolut dari Waktu ke Waktu</strong>
          <p>Memantau total nilai selisih absolut antarperiode berdasarkan ledger stok dan toleransi aktif.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <small>{directionLabel}</small>
          <div><strong>Rata-rata: {formatCurrency(trend.averageAbsoluteValue)}</strong></div>
        </div>
      </div>

      {trend.buckets.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted-foreground)" }}>
          Belum ada riwayat rentang tanggal untuk membentuk tren varians.
        </div>
      ) : (
        <div style={{ overflowX: "auto", width: "100%", paddingBottom: "0.5rem" }}>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", minWidth: "500px", height: "180px" }} role="img" aria-label="Grafik tren nilai varians absolut">
            <line x1={paddingLeft} x2={chartWidth - paddingRight} y1={paddingTop} y2={paddingTop} stroke="var(--border)" strokeDasharray="4 4" />
            <line x1={paddingLeft} x2={chartWidth - paddingRight} y1={paddingTop + usableHeight / 2} y2={paddingTop + usableHeight / 2} stroke="var(--border)" strokeDasharray="4 4" />
            <line x1={paddingLeft} x2={chartWidth - paddingRight} y1={paddingTop + usableHeight} y2={paddingTop + usableHeight} stroke="var(--border)" />
            
            <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{formatCurrency(maxAbs)}</text>
            <text x={paddingLeft - 8} y={paddingTop + usableHeight / 2 + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{formatCurrency(maxAbs / 2)}</text>
            <text x={paddingLeft - 8} y={paddingTop + usableHeight + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">Rp 0</text>

            {points.length > 1 && <polyline points={polylinePoints} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

            {points.map((p) => (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r="5" fill="var(--background)" stroke="var(--primary)" strokeWidth="3">
                  <title>{`${p.label}: Absolut ${formatCurrency(p.totalAbsoluteVarianceValue)}, Kelebihan ${formatCurrency(p.totalExcessVarianceValue)}, Luar Toleransi: ${p.outOfToleranceCount} bahan`}</title>
                </circle>
                <text x={p.x} y={chartHeight - 12} textAnchor="middle" fontSize="11" fill="var(--foreground)">{p.label}</text>
              </g>
            ))}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0 0.5rem", fontSize: "0.85rem", color: "var(--muted-foreground)" }}>
            <span>Periode aktif saat ini: <strong>{currentRangeLabel}</strong></span>
            <span>Maksimal absolut: <strong>{formatCurrency(trend.maxAbsoluteValue)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
