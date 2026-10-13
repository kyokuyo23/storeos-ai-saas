import { useState } from "react";
import { Eye, EyeOff, KeyRound, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell, EmptyState, ErrorState, PageHeader, Panel } from "@/components/FoundationShell";

const MIN_PASSWORD = 8;
type AccessLevel = "member" | "sysadmin";
const emptyForm: { name: string; username: string; password: string; accessLevel: AccessLevel } = { name: "", username: "", password: "", accessLevel: "member" };
const ACCESS_LABEL: Record<AccessLevel, string> = { member: "Kasir", sysadmin: "Admin sistem" };
const wib = (value: Date | string | null | undefined) => (value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB" : "—");

function PasswordInput({ value, onChange, label, autoComplete = "new-password" }: { value: string; onChange: (value: string) => void; label: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return <span className="password-input">
    <input className="form-input" type={show ? "text" : "password"} autoComplete={autoComplete} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} minLength={MIN_PASSWORD} required />
    <button type="button" className="password-toggle" onClick={() => setShow((current) => !current)} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={show}>{show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}</button>
  </span>;
}

/** Owner or admin sistem: create staff accounts, set their role, reset passwords, deactivate or reactivate them. */
export function UserAccountsPage() {
  const utils = trpc.useUtils();
  const me = useAuth().user;
  const list = trpc.users.list.useQuery(undefined, { retry: false });
  const [form, setForm] = useState(emptyForm);
  const [resetFor, setResetFor] = useState<{ id: number; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const refresh = () => utils.users.list.invalidate();

  const create = trpc.users.create.useMutation({
    onSuccess: (member) => { toast.success(`Akun ${member.username} dibuat. Berikan nama pengguna dan kata sandi kepada karyawan.`); setForm(emptyForm); refresh(); },
    onError: (error) => toast.error(error.message || "Akun gagal dibuat."),
  });
  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => { toast.success("Kata sandi diganti. Sesi lama karyawan ini otomatis keluar."); setResetFor(null); setNewPassword(""); },
    onError: (error) => toast.error(error.message || "Kata sandi gagal diganti."),
  });
  const setActive = trpc.users.setActive.useMutation({
    onSuccess: (_result, input) => { toast.success(input.isActive ? "Akun diaktifkan kembali." : "Akun dinonaktifkan dan langsung keluar dari semua perangkat."); refresh(); },
    onError: (error) => toast.error(error.message || "Status akun gagal diubah."),
  });

  const setAccessLevel = trpc.users.setAccessLevel.useMutation({
    onSuccess: (_result, input) => { toast.success(`Peran diubah menjadi ${ACCESS_LABEL[input.accessLevel]}.`); refresh(); },
    onError: (error) => toast.error(error.message || "Peran gagal diubah."),
  });

  const submit = (event: React.FormEvent) => { event.preventDefault(); create.mutate(form); };
  const submitReset = (event: React.FormEvent) => { event.preventDefault(); if (resetFor) resetPassword.mutate({ id: resetFor.id, password: newPassword }); };

  return <AppShell active="users" eyebrow="Akses" title="Pengguna">
    <PageHeader eyebrow="AKSES TOKO" title="Pengguna" description="Kasir: Dashboard, POS, Products, Inventory, Sales, Alerts, Insights, dan melihat Reports. Admin sistem: semua itu ditambah Settings dan Pengguna. Arsip, ekspor & governance laporan tetap khusus pemilik (login “pemilik” atau “owner”)." />
    <Panel title="Tambah akun" description={`Nama pengguna 3–32 karakter (huruf kecil, angka, titik, minus, garis bawah). Kata sandi minimal ${MIN_PASSWORD} karakter.`}>
      <form className="form-grid" onSubmit={submit}>
        <label className="field"><span>Nama lengkap</span><input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Sari Wulandari" maxLength={80} required /></label>
        <label className="field"><span>Nama pengguna (untuk login)</span><input className="form-input" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })} placeholder="Contoh: sari" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={32} required /></label>
        <label className="field"><span>Kata sandi awal</span><PasswordInput label="Kata sandi awal" value={form.password} onChange={(password) => setForm({ ...form, password })} /></label>
        <label className="field"><span>Peran</span><select className="form-input" value={form.accessLevel} onChange={(event) => setForm({ ...form, accessLevel: event.target.value as AccessLevel })}><option value="member">Kasir</option><option value="sysadmin">Admin sistem</option></select></label>
        <div className="form-actions"><button className="button primary" disabled={create.isPending || form.password.length < MIN_PASSWORD || !form.username.trim() || !form.name.trim()}><UserPlus size={16} /> {create.isPending ? "Membuat…" : "Buat akun"}</button></div>
      </form>
    </Panel>
    {resetFor && <Panel title={`Ganti kata sandi: ${resetFor.username}`} description="Setelah diganti, karyawan harus login ulang dengan kata sandi baru di semua perangkat.">
      <form className="form-grid" onSubmit={submitReset}>
        <label className="field"><span>Kata sandi baru</span><PasswordInput label="Kata sandi baru" value={newPassword} onChange={setNewPassword} /></label>
        <div className="form-actions"><button type="button" className="button ghost" onClick={() => { setResetFor(null); setNewPassword(""); }}>Batal</button><button className="button primary" disabled={resetPassword.isPending || newPassword.length < MIN_PASSWORD}><KeyRound size={16} /> {resetPassword.isPending ? "Menyimpan…" : "Simpan kata sandi"}</button></div>
      </form>
    </Panel>}
    <Panel title="Daftar akun" description="Pemilik login dengan nama pengguna “pemilik” atau “owner” dan tidak tercantum di sini.">
      {list.isLoading ? <div className="loading-state"><span className="loading-dot" /> Memuat data…</div> : list.isError ? <ErrorState message={list.error.message || "Daftar pengguna gagal dimuat."} /> : !list.data?.length ? <EmptyState title="Belum ada akun karyawan." description="Tambahkan akun pertama di atas." icon={Users} /> : <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Nama pengguna</th><th>Peran</th><th>Status</th><th>Login terakhir</th><th>Aksi</th></tr></thead><tbody>{list.data.map((member) => <tr key={member.id}>
        <td><strong>{member.name}</strong><small>Dibuat {wib(member.createdAt)}</small></td>
        <td><code>{member.username}</code>{me?.id === member.id && <small>Akun Anda</small>}</td>
        <td>{me?.id === member.id ? ACCESS_LABEL[(member.accessLevel as AccessLevel) ?? "member"] : <select className="form-input compact-select" aria-label={`Peran ${member.username}`} value={member.accessLevel} disabled={setAccessLevel.isPending} onChange={(event) => setAccessLevel.mutate({ id: member.id, accessLevel: event.target.value as AccessLevel })}><option value="member">Kasir</option><option value="sysadmin">Admin sistem</option></select>}</td>
        <td><span className={`badge ${member.isActive ? "success" : "neutral"}`}>{member.isActive ? "Aktif" : "Nonaktif"}</span></td>
        <td>{member.lastSignedIn && member.createdAt && new Date(member.lastSignedIn).getTime() > new Date(member.createdAt).getTime() + 1000 ? wib(member.lastSignedIn) : "Belum pernah"}</td>
        <td><div className="user-actions"><button type="button" className="button ghost compact-button" onClick={() => { setResetFor({ id: member.id, username: member.username ?? "" }); setNewPassword(""); }}><KeyRound size={14} /> Ganti sandi</button>{me?.id !== member.id && <button type="button" className={`button ${member.isActive ? "ghost danger-text" : "secondary"} compact-button`} disabled={setActive.isPending} onClick={() => { if (!member.isActive || window.confirm(`Nonaktifkan akun ${member.username}? Karyawan ini langsung keluar dan tidak bisa login.`)) setActive.mutate({ id: member.id, isActive: !member.isActive }); }}>{member.isActive ? "Nonaktifkan" : "Aktifkan"}</button>}</div></td>
      </tr>)}</tbody></table></div>}
    </Panel>
  </AppShell>;
}
