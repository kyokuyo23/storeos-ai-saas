# Deploy StoreOS ke Vercel

Branch: `vercel-deploy`. Vercel membaca `vercel.json`: frontend (`dist/public`) dilayani statis, `/api/*` dijalankan oleh fungsi serverless `api/index.js` yang memuat bundle Express (`server-dist/app.mjs`, dibuat oleh `pnpm build:vercel`).

## Pengaturan proyek Vercel
- Framework Preset: **Other** (atau biarkan; `vercel.json` menimpa build/output).
- Production Branch: `vercel-deploy`.
- Build/Install/Output diambil dari `vercel.json` (jangan diisi manual).

## Environment Variables (Settings → Environment Variables)
| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | MySQL. Untuk TiDB Cloud Serverless tambahkan SSL di ujung URL: `mysql://USER:PASS@HOST:4000/DB?ssl={"rejectUnauthorized":true}` |
| `JWT_SECRET` | ya | String acak panjang (cookie sesi). |
| `OWNER_OPEN_ID` | ya | ID tetap pemilik, mis. `owner-1` (tidak boleh diawali `cron_`). Akun ini otomatis admin. |
| `OWNER_PASSWORD` | ya | Kata sandi login pemilik di `/login`, **minimal 12 karakter**, acak. Login ditolak jika lebih pendek. |

Tidak perlu `VITE_APP_ID`, `OAUTH_SERVER_URL`, atau `BUILT_IN_FORGE_*`. Tanpa Forge, file ekspor dan arsip laporan disimpan (byte persis) di tabel `storedObjects` pada database yang sama. Jika kedua variabel Forge diisi, Forge tetap dipakai.

## Setup database (sekali)
Dari komputer atau Codespaces: `DATABASE_URL='...' pnpm db:push`. Ini menerapkan semua migrasi, termasuk `0023` (indeks ekspor retensi) dan `0024` (penyimpanan objek).

## Login
Buka `https://<domain>/login`, masukkan `OWNER_PASSWORD`. Sesi berlaku 1 tahun di cookie. Mengganti `OWNER_PASSWORD` tidak mengeluarkan sesi lama; ganti `JWT_SECRET` untuk memaksa semua sesi keluar.

## Keamanan (penting)
- Fitur dasar (POS, produk, stok, penjualan, pengaturan) memakai endpoint publik sejak desain awal: tanpa login pun bisa dibaca dan diubah oleh siapa saja yang tahu URL. Sampai fitur dasar dikunci, aktifkan **Settings → Deployment Protection → Vercel Authentication** atau jangan sebarkan URL.
- Tambahkan aturan rate limit di **Vercel Firewall** untuk `POST /api/auth/owner-login` (mis. 10 permintaan/menit per IP). Jeda 0,6 detik per percobaan gagal tidak cukup melawan percobaan paralel.
- Error database mentah (SQL) tidak pernah dikirim ke browser; detailnya hanya di log Vercel.

## Batas platform
- Respons fungsi Vercel maksimal 4,5 MB. Ekspor dan arsip saat ini berukuran beberapa KB; berkas ratusan KB pun aman.
- TiDB membatasi satu baris sekitar 6 MB (penyimpanan objek di tabel `storedObjects`).

## Catatan
- Pembuatan arsip laporan bulanan otomatis (`/api/scheduled/monthly-management-report`) memakai cron Manus dan tidak berjalan di Vercel. Di Vercel, daftar arsip akan kosong sampai pembuatan arsip dijadwalkan dengan cara lain.
- Analitik Umami hanya dimuat bila `VITE_ANALYTICS_ENDPOINT` dan `VITE_ANALYTICS_WEBSITE_ID` diisi.
