import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportVarianceRow = {
  ingredientName: string;
  unit: string;
  costPerUnit: number;
  openingStock: number;
  purchases: number;
  theoreticalConsumption: number;
  expectedClosingStock: number;
  actualClosingStock: number;
  variance: number;
  varianceValue: number;
  status: "ok" | "over" | "under";
  varianceExcess: number;
  varianceExcessValue: number;
};

export function exportHighValueVarianceCsv(rows: ExportVarianceRow[], startDate: Date, endDate: Date, auditNote?: string) {
  const formatIdDate = (d: Date) => d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
  const periodStr = `${formatIdDate(startDate)} - ${formatIdDate(endDate)}`;
  
  const headers = [
    "Bahan",
    "Satuan",
    "Stok Ekspektasi",
    "Stok Aktual",
    "Selisih (Variance)",
    "Status",
    "Kelebihan",
    "Nilai Selisih (Rp)"
  ];

  const csvRows = [
    `"Laporan Pengecualian Varians Bernilai Tinggi - Kopi Nusantara (Cibitung Bekasi)"`,
    `"Periode: ${periodStr}"`,
    `"Diekspor pada: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}"`
  ];

  if (auditNote && auditNote.trim() !== "") {
    csvRows.push(`"Catatan Audit: ${auditNote.replace(/"/g, '""')}"`);
  }

  csvRows.push("");
  csvRows.push(headers.map(h => `"${h}"`).join(","));

  for (const row of rows) {
    const statusLabel = row.status === "over" ? "Lebih (Over)" : row.status === "under" ? "Kurang (Under)" : "Sesuai (OK)";
    const line = [
      `"${row.ingredientName}"`,
      `"${row.unit}"`,
      row.expectedClosingStock,
      row.actualClosingStock,
      row.variance,
      `"${statusLabel}"`,
      row.varianceExcess,
      row.varianceExcessValue
    ];
    csvRows.push(line.join(","));
  }

  const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `laporan_varians_bernilai_tinggi_${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportHighValueVariancePdf(rows: ExportVarianceRow[], startDate: Date, endDate: Date, auditNote?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const formatIdDate = (d: Date) => d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
  const periodStr = `${formatIdDate(startDate)} - ${formatIdDate(endDate)}`;

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Kopi Nusantara (Cibitung Bekasi) - Laporan Pengecualian Varians", 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${periodStr} | Diekspor: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`, 14, 22);

  let startY = 28;
  if (auditNote && auditNote.trim() !== "") {
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Catatan Audit: ${auditNote}`, 14, 28);
    startY = 34;
  }

  const tableHeaders = [
    "Bahan",
    "Satuan",
    "Ekspektasi",
    "Aktual",
    "Selisih",
    "Status",
    "Kelebihan",
    "Nilai Selisih (Rp)"
  ];

  const tableData = rows.map(row => [
    row.ingredientName,
    row.unit,
    row.expectedClosingStock.toString(),
    row.actualClosingStock.toString(),
    row.variance.toString(),
    row.status === "over" ? "Lebih" : row.status === "under" ? "Kurang" : "Sesuai",
    row.varianceExcess.toString(),
    row.varianceExcessValue.toLocaleString("id-ID")
  ]);

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [241, 245, 249] }
  });

  doc.save(`laporan_varians_bernilai_tinggi_${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.pdf`);
}
