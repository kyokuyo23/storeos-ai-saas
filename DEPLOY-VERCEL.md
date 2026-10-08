# Deploy StoreOS ke Vercel

Branch: `vercel-deploy`. Vercel membaca `vercel.json`: frontend (`dist/public`) dilayani statis, `/api/*` dijalankan oleh fungsi serverless `api/index.js` yang memuat bundle Express (`server-dist/app.mjs`, dibuat oleh `pnpm build:vercel`).

## Pengaturan proyek Vercel
- Framework Preset: **Other** (atau biarkan; `vercel.json` menimpa build/output).
- Production Branch: `vercel-deploy`.
- Build/Install/Output diambil dari `vercel.json` (jangan diisi manual).

## Environment Variables (Settings → Environment Variables)
| Nama | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ya | MySQL (mis. TiDB Cloud, Railway, Aiven). Jalankan `pnpm db:push` sekali ke database ini. |
| `JWT_SECRET` | ya | String acak panjang untuk cookie sesi. |
| `OWNER_OPEN_ID` | ya | openId pemilik/owner-admin. |
| `VITE_APP_ID`, `OAUTH_SERVER_URL` | login | Login saat ini memakai OAuth Manus; di luar Manus perlu diganti. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | export/artefak | Storage Forge milik Manus; di luar Manus ganti `server/storage.ts` ke S3/Vercel Blob. |

Tanpa `DATABASE_URL` halaman tampil tetapi data gagal dimuat. Tanpa login dan storage yang berfungsi, fitur owner-admin (termasuk Phase 2.23) belum dapat dipakai.
