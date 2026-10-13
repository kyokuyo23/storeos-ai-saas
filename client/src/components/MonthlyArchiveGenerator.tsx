import { Archive } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const monthLabel = (year: number, month: number) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(Date.UTC(year, month - 1, 15)));

/** True when the whole Jakarta calendar month has ended (archives are write-once for completed months). */
export function isCompletedJakartaMonthClient(year: number, month: number, now = new Date()) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`).getTime() <= now.getTime();
}

/** Owner-only manual archive (backfill) for the selected completed month; the Vercel cron does the same monthly. */
export function MonthlyArchiveGenerator({ year, month }: { year: number; month: number }) {
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);
  const mutation = trpc.reports.generateMonthlyArtifact.useMutation({
    onSuccess: async (result) => {
      setNotice(result.created
        ? { tone: "success", text: `Arsip ${monthLabel(year, month)} dibuat: CSV, HTML, dan PDF tersimpan dengan checksum SHA-256.` }
        : { tone: "info", text: `Arsip ${monthLabel(year, month)} sudah ada. Arsip tidak ditimpa (write-once).` });
      await Promise.all([utils.reports.monthlyArtifacts.invalidate(), utils.reports.monthlyArtifactGovernance.invalidate(), utils.reports.monthlyActiveArtifactSummary.invalidate()]);
    },
    onError: (error) => setNotice({ tone: "error", text: error.message || "Arsip gagal dibuat. Tidak ada data yang diubah." }),
  });
  const completed = isCompletedJakartaMonthClient(year, month);
  return <div className="archive-generator" role="group" aria-label="Buat arsip laporan bulanan">
    <div>
      <strong>Arsip {monthLabel(year, month)}</strong>
      <small>{completed ? "Simpan laporan bulan ini sebagai arsip permanen (CSV, HTML, PDF). Otomatis juga dibuat setiap tanggal 1 pukul 00.10 WIB." : "Arsip hanya bisa dibuat setelah bulan ini selesai (WIB)."}</small>
    </div>
    <button type="button" className="button primary compact-button" disabled={!completed || mutation.isPending} onClick={() => { setNotice(null); mutation.mutate({ year, month }); }}>
      <Archive size={15} /> {mutation.isPending ? "Membuat arsip…" : "Buat arsip"}
    </button>
    {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "integrity-error" : "integrity-success"}>{notice.text}</p>}
  </div>;
}
