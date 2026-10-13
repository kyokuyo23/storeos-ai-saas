# Deploy StoreOS ke Vercel

Branch: `vercel-deploy`. Vercel membaca `vercel.json`: frontend (`dist/public`) dilayani statis, `/api/*` dijalankan oleh fungsi serverless `api/index.js` yang memuat bundle Express (`server-dist/app.mjs`, dibuat oleh `pnpm build:vercel`).

## Pengaturan proyek Vercel
- Framework Preset: **Other** (atau biarkan; `vercel.json` menimpa build/output).
- Production Branch: `vercel-deploy`.
- Build/Install/Output diambil dari `vercel.json` (jangan diisi manual).

## Environment Variables (Settings → Environment Variables)
| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | Supabase (PostgreSQL) lewat **Transaction pooler** (port **6543**), plus `?sslmode=require`. Contoh: `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require` (Supabase → Connect → Transaction pooler). |
| `JWT_SECRET` | ya | String acak panjang (cookie sesi). |
| `OWNER_OPEN_ID` | ya | ID tetap pemilik, mis. `owner-1` (tidak boleh diawali `cron_`). Akun ini otomatis admin. |
| `CRON_SECRET` | ya (arsip otomatis) | String acak (min. 16 karakter). Vercel Cron mengirimkannya sebagai `Authorization: Bearer …` ke `/api/scheduled/monthly-management-report`; tanpa variabel ini cron ditolak (401). |
| `OWNER_PASSWORD` | ya | Kata sandi login pemilik di `/login`, **minimal 12 karakter**, acak. Login ditolak jika lebih pendek. |

Tidak perlu `VITE_APP_ID`, `OAUTH_SERVER_URL`, atau `BUILT_IN_FORGE_*`. Tanpa Forge, file ekspor dan arsip laporan disimpan (byte persis) di tabel `storedObjects` pada database yang sama. Jika kedua variabel Forge diisi, Forge tetap dipakai.

## Setup database Supabase (sekali) — pilih SATU cara
Skema ada di `supabase/migrations/` (dibuat dari `drizzle/pg/`). Jangan jalankan dua cara sekaligus (tabel akan dibuat dua kali dan migrasi kedua gagal).

1. **SQL Editor (paling mudah):** Supabase → SQL Editor → tempel isi `supabase/migrations/20261012000000_storeos_init.sql` → Run, lalu `20261012000100_storeos_enable_rls.sql` → Run.
2. **Integrasi GitHub Supabase:** Project Settings → Integrations → GitHub → pilih repo `kyokuyo23/storeos-ai-saas`, Supabase directory `.`, production branch = branch yang dipakai Vercel, aktifkan **Deploy to production**. Migrasi di `supabase/migrations/` dijalankan otomatis saat push.
3. **Drizzle (developer):** `DATABASE_URL='<session pooler / direct URL, port 5432>' pnpm drizzle-kit migrate` (memakai `drizzle/pg/`).

Migrasi kedua mengaktifkan Row Level Security di semua tabel tanpa policy: Data API Supabase (anon key) tidak bisa membaca/menulis tabel StoreOS, sedangkan server StoreOS (pemilik tabel) tetap bisa. Folder `drizzle/mysql-legacy/` hanya arsip skema MySQL lama (Manus).

## Login
Semua halaman dan API wajib login. Buka `https://<domain>/login`:

- **Pemilik (owner-admin):** nama pengguna `pemilik`, kata sandi `OWNER_PASSWORD`. Sesi berlaku 1 tahun.
- **Karyawan (member):** akun dibuat pemilik di menu **Pengguna** (nama pengguna + kata sandi, disimpan sebagai hash scrypt). Sesi berlaku 30 hari; ganti sandi atau nonaktifkan akun langsung mengeluarkan sesi karyawan tersebut.
- Karyawan dapat memakai Dashboard, POS, Products, Inventory, Sales, Alerts, Insights, dan melihat Reports. Arsip/ekspor/governance laporan, Settings, dan Pengguna khusus pemilik (dicek di server).

Migrasi kolom akun: `supabase/migrations/20261013000000_storeos_user_accounts.sql`. Mengganti `OWNER_PASSWORD` tidak mengeluarkan sesi lama; ganti `JWT_SECRET` untuk memaksa semua sesi keluar.

## Keamanan (penting)
- Fitur dasar (POS, produk, stok, penjualan, pengaturan) memakai endpoint publik sejak desain awal: tanpa login pun bisa dibaca dan diubah oleh siapa saja yang tahu URL. Sampai fitur dasar dikunci, aktifkan **Settings → Deployment Protection → Vercel Authentication** atau jangan sebarkan URL.
- Tambahkan aturan rate limit di **Vercel Firewall** untuk `POST /api/auth/owner-login` (mis. 10 permintaan/menit per IP). Jeda 0,6 detik per percobaan gagal tidak cukup melawan percobaan paralel.
- Error database mentah (SQL) tidak pernah dikirim ke browser; detailnya hanya di log Vercel.

## Batas platform
- Respons fungsi Vercel maksimal 4,5 MB. Ekspor dan arsip saat ini berukuran beberapa KB; berkas ratusan KB pun aman.
- File ekspor/arsip disimpan sebagai `bytea` di tabel `storedObjects`; ukurannya beberapa KB sehingga jauh di bawah batas Supabase.
- Paket gratis Supabase dapat menjeda proyek yang lama tidak aktif; cek kebijakan terbaru di dashboard Supabase.

## Catatan
- Arsip laporan bulanan: `vercel.json` menjadwalkan Vercel Cron setiap hari 17:10 UTC (00:10 WIB); hanya pada tanggal 1 (WIB) arsip bulan sebelumnya dibuat, hari lain dilewati. Pemilik juga bisa membuat arsip bulan yang sudah selesai secara manual di Reports → Artefak laporan tersimpan → **Buat arsip**. Arsip bersifat write-once per bulan.
- Analitik Umami hanya dimuat bila `VITE_ANALYTICS_ENDPOINT` dan `VITE_ANALYTICS_WEBSITE_ID` diisi.
