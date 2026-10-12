import { useState } from "react";

/** Password login for deployments without Manus OAuth. */
export default function OwnerLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/owner-login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ password }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Login gagal.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "#f4f1ea" }}>
    <form onSubmit={submit} aria-label="Masuk sebagai pemilik" style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 8px 30px rgba(18,58,44,.12)", display: "grid", gap: 14 }}>
      <div><h1 style={{ margin: 0, fontSize: 22, color: "#123a2c" }}>StoreOS</h1><p style={{ margin: "4px 0 0", color: "#5b6b63", fontSize: 14 }}>Masuk sebagai pemilik</p></div>
      <label style={{ display: "grid", gap: 6, fontSize: 14 }}>Kata sandi
        <input type="password" autoComplete="current-password" autoFocus required value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #c9d3cd", fontSize: 16 }} />
      </label>
      {error && <p role="alert" style={{ margin: 0, color: "#b3261e", fontSize: 14 }}>{error}</p>}
      <button type="submit" className="button primary" disabled={busy || !password}>{busy ? "Memeriksa…" : "Masuk"}</button>
    </form>
  </main>;
}
