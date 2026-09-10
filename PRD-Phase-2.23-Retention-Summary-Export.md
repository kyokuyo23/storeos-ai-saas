# PRD — StoreOS Phase 2.23
## Ekspor Ringkasan Retensi Artefak

**Status:** Draft untuk review produk  
**Penulis:** Manus AI  
**Depends on:** Phase 2.22 — Retention Indicator  
**Audience:** Product, Engineering, QA, Governance  
**Timezone:** Asia/Jakarta (WIB)

## 1. Product Intent

Reports membutuhkan kemampuan untuk mengubah Ringkasan Artefak Aktif menjadi snapshot governance yang dapat diunduh dan diverifikasi. Fitur ini menyediakan dua format: **CSV** untuk analisis spreadsheet dan **printable/PDF-compatible output** untuk review atau pengarsipan manual. Keduanya harus merepresentasikan dataset retensi yang sama pada scope periode review yang sama.

Fitur ini bersifat **read-only**. Tombol ekspor hanya membaca metadata artefak dan hasil klasifikasi retensi yang sudah ada. Tidak ada automatic archival, perubahan lifecycle, perubahan retention policy, atau penulisan ke Financial Core dan Inventory Intelligence.

## 2. User and Access Model

| User | Behavior |
|---|---|
| Owner-admin yang terotorisasi | Dapat melihat ringkasan, menghasilkan CSV/printable output, dan melakukan verifikasi integrity |
| Member/non-admin | Tidak boleh memperoleh dataset atau bytes ekspor melalui client workaround |
| User dari scope lain | Ditolak server-side |
| Anonymous user | Mengikuti auth guard yang telah ada; tidak memperoleh data |

Client filter hanya merupakan UX. Authorization dan scope enforcement wajib berada di server.

## 3. Scope dan Source of Truth

Input produk berasal dari state **Periode review laporan** Phase 2.19 dan filter aktif Phase 2.21–2.22. Scope dapat berupa preset review Jakarta/WIB atau rentang manual yang tervalidasi. Ekspor harus memakai batas inclusive-start dan exclusive-end yang sama dengan ringkasan aktif.

Dataset yang diekspor hanya mencakup production artifacts yang:

1. Berada dalam owner scope yang sah.
2. Berada dalam range review yang diminta.
3. Merupakan bundle CSV/HTML/PDF yang aktif dan terverifikasi.
4. Memiliki integrity state yang sehat sesuai semantik ringkasan aktif.
5. Tidak archived, retired, missing, corrupt, non-production, atau berada di luar scope.

## 4. Product Requirements

### P0 — Ringkasan dan metadata

Ekspor wajib memuat timezone `Asia/Jakarta`, selected scope, `range.startWib`, `range.endWib`, inclusive `startDate`, inclusive `endDate`, jumlah periode kalender, waktu evaluasi, retention window, warning window, dan status bahwa output bersifat read-only.

### P0 — Retention summary dataset

Snapshot wajib memuat total active artifact bundles, total per format CSV/HTML/PDF, jumlah normal, jumlah approaching, jumlah eligible, per-format count untuk approaching, oldest active artifact, newest active artifact, oldest approaching artifact, verified bundle count, excluded bundle count, dan availability/integrity counts.

### P0 — Exact-byte integrity

Server menghasilkan bytes final terlebih dahulu, kemudian menghitung SHA-256 dan byte size dari bytes tersebut. Metadata integrity tidak boleh dihitung dari object JSON yang berbeda dengan file yang diunduh. Verification harus menerima atau membaca exact bytes melalui controlled path dan mengembalikan hasil `verified` atau `hash_mismatch` secara eksplisit.

### P0 — Deterministic output

Untuk input scope, dataset, dan evaluation timestamp yang sama, output memiliki urutan record, header, label, dan serialisasi yang sama. Timestamp generator dan evaluation timestamp harus dinyatakan secara eksplisit agar reviewer dapat membedakan waktu snapshot dan waktu verifikasi.

### P1 — UX Reports

Reports menampilkan action **Ekspor Ringkasan Retensi** hanya pada panel Ringkasan Artefak Aktif dan hanya kepada owner-admin. Action mempertahankan konteks preset/rentang yang sedang dipilih. Setelah sukses, UI menampilkan format, ukuran bytes, SHA-256, generated-at WIB, selected scope, dan status verifikasi.

### P1 — Empty dan error states

Scope tanpa active verified bundle menampilkan hasil kosong yang valid dan dapat diekspor apabila kontrak mengizinkan zero-record snapshot. Error authorization, invalid range, missing data, integrity failure, dan server failure ditampilkan terpisah tanpa membocorkan storage internals.

### P1 — Responsive behavior

Panel ekspor harus usable pada desktop dan mobile. Metadata hash boleh dipotong secara visual dengan affordance copy, tetapi nilai yang disalin harus lengkap. Tidak boleh ada horizontal overflow yang menghalangi action utama.

## 5. User Flows

### 5.1 Export CSV

Owner-admin memilih preset atau rentang manual, meninjau Ringkasan Artefak Aktif, lalu memilih **Ekspor CSV**. Server memvalidasi auth, scope, dan input; membaca dataset Phase 2.22; membentuk exact bytes; menghitung hash dan size; lalu mengembalikan download serta metadata. UI menampilkan hasil dan status verifikasi.

### 5.2 Export printable/PDF-compatible

Owner-admin memilih **Ekspor Printable/PDF**. Server memakai dataset dan metadata yang sama dengan CSV, tetapi format presentasinya ditujukan untuk print/review. Jika pipeline menghasilkan PDF bytes, bytes PDF tersebut wajib menjadi bytes yang di-hash dan diunduh. Jika output berupa printable HTML, UI harus menyatakan format sebenarnya dan tidak menyebutnya PDF secara keliru.

### 5.3 Verify integrity

Owner-admin memilih **Verifikasi** pada hasil ekspor. Server menghitung ulang SHA-256 terhadap exact bytes dan membandingkannya dengan metadata. Hasil mismatch harus eksplisit, tidak boleh dianggap sukses, dan tidak boleh memicu lifecycle transition.

### 5.4 Invalid or unauthorized request

Request dengan scope invalid, kombinasi preset dan manual range yang konflik, role tidak sesuai, atau owner scope tidak sesuai harus dihentikan server-side. UI menampilkan pesan aman tanpa SQL key, storage URL, credential, atau detail internal.

## 6. UX Content

| State | Label yang disarankan |
|---|---|
| Ready | `Ekspor ringkasan retensi` |
| Read-only notice | `Ekspor ini hanya snapshot review; tidak mengubah lifecycle atau data operasional.` |
| Integrity verified | `Integritas terverifikasi` |
| Integrity mismatch | `Integritas tidak cocok; file tidak dapat dipercaya.` |
| Empty | `Tidak ada artefak aktif terverifikasi pada scope ini.` |
| Unauthorized | `Akses ringkasan retensi dibatasi untuk owner-admin.` |
| Loading | `Menyiapkan snapshot retensi…` |

## 7. Acceptance Criteria

| ID | Acceptance criterion | Evidence |
|---|---|---|
| AC-01 | Owner-admin dapat mengekspor CSV dari preset dan custom range yang valid | Browser + router test |
| AC-02 | Output menggunakan scope dan range WIB yang sama dengan Ringkasan Artefak Aktif | Unit + browser test |
| AC-03 | CSV memiliki UTF-8 BOM, header stabil, quoting aman, dan Unicode Indonesia | Exact-byte test |
| AC-04 | Printable/PDF-compatible output memakai dataset yang sama dan format dinyatakan benar | Unit + browser test |
| AC-05 | SHA-256 dan byte size cocok dengan bytes yang diunduh | Integrity test |
| AC-06 | Tampered bytes menghasilkan mismatch eksplisit | Verification test |
| AC-07 | Archived, retired, missing, corrupt, non-production, dan out-of-scope artifacts dikecualikan | Service test |
| AC-08 | Member, anonymous, dan cross-scope request ditolak | Authorization test |
| AC-09 | Ekspor tidak mengubah lifecycle, retention, artifact metadata, scheduler, financial, inventory, ledger, opname, QR, atau governance history | No-mutation regression |
| AC-10 | Empty, loading, invalid, failure, dan unauthorized states tersedia | Browser test |
| AC-11 | URL review/deep-link tetap dipertahankan setelah ekspor atau refresh | Browser test |
| AC-12 | Desktop dan mobile tidak memiliki overflow yang menghalangi action | Visual/browser review |

## 8. Non-functional Requirements

Output harus aman terhadap CSV injection dengan escaping/quoting yang konsisten, tidak boleh mengekspos raw storage credentials atau signed URL internal, dan harus fail closed bila integrity metadata tidak tersedia atau tidak cocok. Server tidak boleh mempercayai `ownerOpenId` dari client sebagai sumber authorization.

Latency target untuk snapshot normal adalah respons interaktif yang wajar tanpa mengubah storage architecture. Jika pembentukan output gagal, tidak boleh ada partial lifecycle state atau partial metadata mutation. Retry pada request yang sama harus menghasilkan snapshot read-only baru atau hasil deterministik sesuai kontrak, tetapi tidak boleh overwrite artifact report dan tidak boleh membuat audit lifecycle event.

## 9. Out of Scope Confirmation

Tidak termasuk scheduled export, email, notification, automatic retention action, archive command, retention policy editor, report artifact regeneration, aggregate financial recalculation, inventory mutation, new database table untuk export history, atau perubahan pada QR/HMAC/revocation/expiry behavior.

## 10. Release Gate

Feature hanya dapat dirilis setelah full Vitest, Playwright, TypeScript check, production build, desktop review, dan mobile review lulus. Dokumen BRD, PRD, dan FRD harus konsisten dengan implementation contract dan seluruh protected-domain regression tests.

## 11. Internal References

PRD ini menggunakan spesifikasi Phase 2.23 pada `pasted_content_20.txt`, source retention pada `server/monthlyReportArtifacts.ts`, serta exact-byte governance export utilities pada `server/governanceAuditExportIntegrity.ts` sebagai referensi internal.
