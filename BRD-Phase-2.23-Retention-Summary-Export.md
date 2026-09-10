# BRD — StoreOS Phase 2.23
## Read-only Retention Summary Export

**Status:** Draft untuk review produk dan governance  
**Pemilik:** StoreOS Product & Governance  
**Penulis:** Manus AI  
**Basis implementasi:** Phase 2.22 yang telah dirilis  
**Zona waktu bisnis:** Asia/Jakarta (WIB)

## 1. Ringkasan Eksekutif

StoreOS telah memiliki governance artefak laporan bulanan, lifecycle, retention indicator, Ringkasan Artefak Aktif, deep-link daftar artefak, dan filter status retensi. Phase 2.23 bertujuan menyediakan **ekspor read-only** dari ringkasan retensi untuk scope periode review Reports yang sedang dipilih owner-admin.

Ekspor ini harus menjadi snapshot yang dapat ditinjau, diunduh, dicetak, dan diverifikasi. Ekspor tidak boleh menjadi sumber perhitungan retensi kedua. Dataset, klasifikasi, scope, dan pengecualian wajib memakai semantik otoritatif yang sudah dirilis pada Phase 2.22.

## 2. Masalah Bisnis

Tanpa ekspor, informasi retensi hanya tersedia di layar Reports. Hal ini membatasi kemampuan owner-admin untuk menyimpan bukti review, membagikan hasil governance secara internal, dan melakukan rekonsiliasi terhadap periode review tertentu. Kebutuhan bisnisnya bukan mengubah lifecycle, melainkan menyediakan representasi terkontrol dari keadaan retensi pada saat evaluasi.

| Masalah | Dampak | Kebutuhan bisnis |
|---|---|---|
| Ringkasan retensi tidak dapat disimpan sebagai bukti review | Review manual sulit diaudit ulang | Sediakan CSV dan printable/PDF-compatible summary |
| Hasil review dapat dipertanyakan integritasnya setelah diunduh | Risiko penggunaan bytes yang berbeda dari metadata | Sediakan ukuran byte dan SHA-256 exact-byte |
| Scope review dapat tercampur dengan artefak lain | Risiko cross-scope disclosure | Terapkan owner-admin authorization dan scope server-side |
| Ekspor dapat disalahartikan sebagai aksi retensi | Risiko perubahan data yang tidak disengaja | Pertahankan perilaku read-only dan tanpa lifecycle mutation |

## 3. Tujuan Bisnis

Tujuan utama adalah meningkatkan **auditability, portability, dan trust** atas review retensi tanpa memperluas hak akses atau mengubah data operasional. Keberhasilan diukur dari kemampuan owner-admin menghasilkan snapshot yang konsisten untuk scope yang dipilih, memverifikasi bytes secara eksplisit, dan membuktikan bahwa proses ekspor tidak memutasi artefak atau domain operasional.

Tujuan ini mencakup:

1. Menyediakan snapshot ringkasan retensi yang mencakup total artefak aktif, klasifikasi normal/approaching/eligible, breakdown format, kandidat tertua, timestamp evaluasi, dan metadata threshold.
2. Menjamin seluruh hasil menggunakan timezone Asia/Jakarta serta scope Reports yang dipilih.
3. Menyediakan CSV UTF-8 BOM dan keluaran printable/PDF-compatible yang dapat digunakan dalam review governance.
4. Memakai kembali infrastruktur integrity export yang telah ada, termasuk exact-byte SHA-256 dan protected verification.
5. Menjaga owner-admin-only access, cross-scope denial, dan read-only integrity.

## 4. Ruang Lingkup

### 4.1 In scope

Phase 2.23 mencakup pengambilan snapshot ringkasan retensi pada scope review aktif, pembentukan CSV deterministic, pembentukan tampilan printable/PDF-compatible, metadata export, exact-byte hashing, protected verification, UI action **Ekspor Ringkasan Retensi**, dan state loading/empty/error/unauthorized/integrity failure.

### 4.2 Out of scope

Phase ini tidak mengubah scheduler atau cron, `reports.monthlySummary`, Financial Core, Inventory Intelligence, stock ledger, stock-opname, report generation, artifact generation, lifecycle, retention duration/policy, automatic archival, owner-approved archive behavior, QR/HMAC/SHA-256 mechanisms, governance audit export, lifecycle history, policy history, notifications, reminders, atau data persistence baru untuk menyimpan export history.

| Domain terlindungi | Keputusan |
|---|---|
| Scheduler | Tidak diubah, tidak dipicu, tidak disimulasikan |
| Financial/Inventory | Tidak dibaca sebagai sumber mutasi dan tidak ditulis |
| Artifact lifecycle | Tidak ada transition, archive, retire, delete, atau metadata update |
| Retention policy | Hanya dibaca melalui semantik otoritatif Phase 2.22 |
| Integrity | Reuse exact-byte infrastructure, bukan hashing model kedua |
| Authorization | Owner-admin server-side; tidak bergantung pada client filter |

## 5. Pemangku Kepentingan dan Nilai

| Pemangku kepentingan | Nilai yang diterima |
|---|---|
| Owner-admin | Bukti review retensi yang dapat diunduh dan diverifikasi |
| Reviewer governance | Dataset ringkas yang memiliki scope, timestamp, dan integrity metadata |
| Operator toko | Tidak ada perubahan pada transaksi, stok, atau scheduler |
| Engineering | Kontrak additive yang reuse service dan verifier yang telah dirilis |
| Auditor internal | Rekonsiliasi format, status, threshold, dan oldest candidate yang deterministik |

## 6. Prinsip Bisnis

> Ekspor adalah representasi read-only dari retention state yang sudah dihitung oleh sistem, bukan perintah untuk menjalankan retention policy.

Prinsip yang wajib dipenuhi adalah source of truth tunggal, Jakarta/WIB-first, least privilege, exact-byte integrity, deterministic output, fail-closed behavior, dan no side effect. Archived, retired, missing, corrupt, dan out-of-scope artifacts tidak boleh dipresentasikan sebagai active retention candidates.

## 7. Risiko dan Mitigasi

| Risiko | Tingkat | Mitigasi |
|---|---:|---|
| Perbedaan kalkulasi antara layar dan ekspor | Tinggi | Panggil dataset/klasifikasi Phase 2.22 yang sama |
| Bytes diunduh berbeda dari bytes yang di-hash | Tinggi | Hash bytes final server-side; expose size dan SHA-256 |
| Cross-scope disclosure | Tinggi | Guard owner-admin dan scope filtering di server |
| Ekspor memicu lifecycle atau archival | Tinggi | Query/generator read-only; regression assertion no mutation |
| Unicode Indonesia rusak di spreadsheet | Sedang | UTF-8 BOM, quoting deterministic, Unicode tests |
| Ambiguitas empty scope | Sedang | Hasil eksplisit dengan count nol, bukan error palsu |

## 8. Metrik Keberhasilan

| Metrik | Target |
|---|---|
| Owner-admin dapat mengekspor scope valid | 100% pada acceptance tests |
| Member atau cross-scope request ditolak | 100% |
| CSV memiliki BOM, headers, quoting, Unicode, size, hash | 100% |
| Exact-byte tamper terdeteksi | 100% |
| Archived/retired/missing/corrupt excluded | 100% |
| Lifecycle/retention/operational mutation saat export | 0 |
| Deterministic counts untuk metadata dan evaluation timestamp yang sama | 100% |

## 9. Kriteria Keputusan Bisnis

Phase 2.23 dapat dinyatakan siap dirilis jika owner-admin dapat menghasilkan dan mengunduh CSV serta printable/PDF-compatible summary, hasilnya menunjukkan scope dan timestamp WIB, integrity metadata dapat diverifikasi, akses tidak berwenang ditolak, serta seluruh regression tests membuktikan tidak ada mutation pada lifecycle, retention, financial, inventory, ledger, stock-opname, QR, atau governance history.

## 10. Sumber Internal

Dokumen ini bersumber dari spesifikasi Phase 2.23 yang disetujui pada `pasted_content_20.txt`, implementasi Phase 2.22 pada `server/monthlyReportArtifacts.ts`, serta pola governance export integrity yang telah dirilis pada `server/governanceAuditExportIntegrity.ts`. Dokumen ini tidak memperkenalkan kebijakan bisnis baru di luar scope tersebut.

## 11. Persetujuan

| Peran | Nama | Status | Tanggal |
|---|---|---|---|
| Product owner |  | Pending |  |
| Governance owner |  | Pending |  |
| Engineering owner |  | Pending |  |
| QA owner |  | Pending |  |
