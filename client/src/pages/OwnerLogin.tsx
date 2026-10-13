import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { StoreMark } from "@/components/FoundationShell";

/** Only same-origin absolute paths ("/x", never "//host" or "/\\host") are allowed as a post-login target. */
export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

/** Username + password login: the owner signs in as "pemilik", staff with the account the owner created. */
export default function OwnerLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branding, setBranding] = useState<{ businessName: string; storeLocation: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/branding").then((response) => (response.ok ? response.json() : null)).then((data) => {
      if (!data) return;
      setBranding(data);
      document.title = `Masuk · ${data.businessName}`;
    }).catch(() => undefined);
  }, []);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, password }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Login gagal.");
        return;
      }
      window.location.href = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "#f4f1ea" }}>
    <form onSubmit={submit} aria-label="Masuk ke StoreOS" style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 8px 30px rgba(18,58,44,.12)", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><StoreMark branding={branding} size={48} /><div><h1 style={{ margin: 0, fontSize: 21, color: "#123a2c" }}>{branding?.businessName ?? "StoreOS"}</h1><p style={{ margin: "3px 0 0", color: "#5b6b63", fontSize: 13 }}>{branding?.storeLocation ? `${branding.storeLocation} · ` : ""}Masuk ke akun Anda</p></div></div>
      <label style={{ display: "grid", gap: 6, fontSize: 14 }}>Nama pengguna
        <input type="text" name="username" autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #c9d3cd", fontSize: 16 }} />
        <small style={{ color: "#5b6b63", fontSize: 12 }}>Pemilik toko: ketik <b>pemilik</b>. Karyawan: nama pengguna dari pemilik.</small>
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 14 }}>Kata sandi
        <span style={{ position: "relative", display: "block" }}>
          <input type={showPassword ? "text" : "password"} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} required value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 44px 10px 12px", borderRadius: 8, border: "1px solid #c9d3cd", fontSize: 16 }} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#5b6b63", cursor: "pointer", borderRadius: 6 }}>
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </span>
      </label>
      {error && <p role="alert" style={{ margin: 0, color: "#b3261e", fontSize: 14 }}>{error}</p>}
      <button type="submit" className="button primary" disabled={busy || !password || !username.trim()}>{busy ? "Memeriksa…" : "Masuk"}</button>
    </form>
  </main>;
}
