import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "../_core/hooks/useAuth";
import "../components/monthly-report-governance.css";

const wibTime = (value: Date | string) => `${new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

export function GovernanceAuditQrVerification() {
  const auth = useAuth();
  const params = new URLSearchParams(window.location.search);
  const input = {
    referenceId: params.get("ref") ?? "",
    exportId: params.get("export") ?? "",
    receiptId: params.get("receipt") ?? "",
  };
  const validReference = /^qr_[a-f0-9]{32}$/.test(input.referenceId) && input.exportId.length >= 32 && input.receiptId.length >= 32;
  const verification = trpc.reports.resolveMonthlyArtifactGovernanceAuditVerificationQr.useQuery(input, {
    enabled: auth.isAuthenticated && validReference,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const expiredResult = verification.data?.status === "expired" ? verification.data : null;
  const revokedResult = verification.data?.status === "revoked" ? verification.data : null;

  return <main className="qr-verification-page">
    <section className="qr-verification-card" aria-label="Verifikasi QR Governance Audit">
      <div className="eyebrow">STOREOS · GOVERNANCE AUDIT</div>
      <h1>Verifikasi referensi QR</h1>
      <p>Referensi QR bukan bukti integritas dengan sendirinya. Server akan menghitung ulang checksum byte ekspor yang tepat sebelum menampilkan hasil.</p>
      {auth.loading ? <div className="loading-state"><span className="loading-dot" /> Memeriksa akses…</div>
        : !auth.isAuthenticated ? <div className="qr-verification-notice"><ShieldCheck size={19} /><div><strong>Akses owner-admin diperlukan</strong><p>Masuk sebagai owner-admin StoreOS untuk memverifikasi referensi QR. QR tidak membuka artefak laporan atau penyimpanan secara langsung.</p><button type="button" className="button secondary compact-button" onClick={startLogin}>Masuk untuk verifikasi</button></div></div>
          : !validReference ? <div role="alert" className="qr-verification-result failed"><XCircle size={20} /><div><strong>Referensi QR tidak valid</strong><p>Parameter referensi tidak lengkap atau tidak sesuai format aman StoreOS.</p></div></div>
            : verification.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memverifikasi checksum ekspor…</div>
              : verification.isError ? <div role="alert" className="qr-verification-result failed"><XCircle size={20} /><div><strong>Verifikasi QR ditolak</strong><p>Referensi tidak dapat divalidasi dalam scope owner-admin ini.</p></div></div>
                : verification.data?.status === "verified" ? <div className="qr-verification-result verified"><CheckCircle2 size={22} /><div><strong>Checksum ekspor terverifikasi</strong><p>Server menghitung ulang SHA-256 dari byte ekspor audit. Halaman ini tidak menyediakan unduhan artefak.</p></div><dl><div><dt>ID ekspor</dt><dd>{verification.data.exportId}</dd></div><div><dt>ID bukti</dt><dd>{verification.data.receiptId}</dd></div><div><dt>Scope</dt><dd>{verification.data.scope}</dd></div><div><dt>Format</dt><dd>{verification.data.format.toUpperCase()}</dd></div><div><dt>Dibuat</dt><dd>{verification.data.generatedAtWib ?? wibTime(verification.data.generatedAt)}</dd></div><div><dt>Diterbitkan</dt><dd>{verification.data.issuedAtWib ?? wibTime(verification.data.issuedAt)}</dd></div><div><dt>Berlaku sampai</dt><dd>{verification.data.expiresAtWib ?? wibTime(verification.data.expiresAt)}</dd></div><div><dt>Diverifikasi</dt><dd>{verification.data.verifiedAtWib ?? wibTime(verification.data.verifiedAt)}</dd></div><div><dt>Ukuran</dt><dd>{verification.data.byteSize} byte</dd></div><div><dt>SHA-256</dt><dd className="qr-hash">{verification.data.sha256}</dd></div><div><dt>Status</dt><dd>{verification.data.verificationStatus}</dd></div></dl></div>
                  : <div role="alert" className="qr-verification-result failed"><XCircle size={20} /><div><strong>{revokedResult ? "Referensi QR dicabut" : expiredResult ? "Referensi QR kedaluwarsa" : "Verifikasi QR gagal"}</strong><p>{verification.data?.message ?? "Referensi QR tidak dapat digunakan."}</p>{revokedResult && <dl><div><dt>ID referensi</dt><dd>{revokedResult.referenceId}</dd></div><div><dt>ID ekspor</dt><dd>{revokedResult.exportId}</dd></div><div><dt>ID bukti</dt><dd>{revokedResult.receiptId}</dd></div><div><dt>Diterbitkan</dt><dd>{revokedResult.issuedAtWib ?? wibTime(revokedResult.issuedAt)}</dd></div><div><dt>Berakhir</dt><dd>{revokedResult.expiresAtWib ?? wibTime(revokedResult.expiresAt)}</dd></div>{revokedResult.revokedAt && <div><dt>Dicabut</dt><dd>{revokedResult.revokedAtWib ?? wibTime(revokedResult.revokedAt)} · {revokedResult.actorOpenId ?? "owner-admin"}</dd></div>}{revokedResult.reason !== undefined && revokedResult.reason !== null && <div><dt>Alasan</dt><dd>{revokedResult.reason}</dd></div>}<div><dt>Status</dt><dd>Dicabut — verifikasi tidak diterima</dd></div></dl>}{expiredResult && <dl><div><dt>Diterbitkan</dt><dd>{expiredResult.issuedAtWib ?? wibTime(expiredResult.issuedAt)}</dd></div><div><dt>Berakhir</dt><dd>{expiredResult.expiresAtWib ?? wibTime(expiredResult.expiresAt)}</dd></div><div><dt>Status</dt><dd>Kedaluwarsa — verifikasi tidak diterima</dd></div></dl>}</div></div>}
    </section>
  </main>;
}
