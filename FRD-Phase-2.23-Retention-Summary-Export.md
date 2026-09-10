# FRD — StoreOS Phase 2.23
## Kontrak Fungsional Ekspor Ringkasan Retensi

**Status:** Draft teknis untuk review engineering dan QA  
**Penulis:** Manus AI  
**Source of truth:** `server/monthlyReportArtifacts.ts` dan integrity export utilities yang telah dirilis  
**Timezone bisnis:** `Asia/Jakarta`

## 1. Tujuan Fungsional

FRD ini mendefinisikan perilaku sistem untuk menghasilkan dan memverifikasi ekspor ringkasan retensi artefak aktif. Fitur harus reuse resolver range, active-artifact summary, retention classifier, owner-admin guard, dan exact-byte integrity infrastructure yang sudah ada. FRD ini tidak mengubah kebijakan retensi, lifecycle transition, storage artifact, scheduler, atau domain operasional.

## 2. Terminologi dan Tipe

| Term | Definisi |
|---|---|
| Active artifact | Bundle laporan yang belum archived/retired dan memenuhi syarat active summary |
| Verified bundle | Bundle CSV/HTML/PDF yang lolos availability dan SHA-256 verification |
| Normal | Artifact belum memasuki warning window |
| Approaching | Artifact berada di warning window sebelum archive eligibility |
| Eligible | Artifact telah melewati cutoff atau lifecycle telah `eligible_for_archive` |
| Snapshot | Representasi read-only dataset pada evaluation time tertentu |
| Exact bytes | Byte sequence final yang benar-benar dikirim atau disimpan sebagai output ekspor |
| Scope | Kombinasi owner scope dan Jakarta/WIB date range |

## 3. Input Contract

### 3.1 Summary scope input

Input summary menggunakan bentuk yang kompatibel dengan `MonthlyReportActiveArtifactSummaryInput`:

```ts
type MonthlyReportActiveArtifactSummaryInput = {
  startDate?: string; // YYYY-MM-DD, inclusive Jakarta date
  endDate?: string;   // YYYY-MM-DD, inclusive Jakarta date
  datePreset?: GovernanceAuditDatePreset;
};
```

Aturan validasi:

1. `datePreset` harus berada dalam allowlist resolver yang telah dirilis.
2. `startDate` dan `endDate` harus berupa calendar date yang valid, bukan timestamp browser-local.
3. Preset dan custom range yang saling bertentangan harus ditolak atau dinormalisasi sesuai kontrak resolver yang sudah ada; client tidak boleh mengoverride server.
4. Range diproses menjadi `startWib` inclusive dan `endWib` exclusive.
5. Semua boundary ditentukan server-side menggunakan Asia/Jakarta.

### 3.2 Export input

Kontrak prosedur export yang disarankan:

```ts
type RetentionSummaryExportInput = {
  scope: MonthlyReportActiveArtifactSummaryInput;
  format: "csv" | "printable";
};
```

Kontrak verification:

```ts
type RetentionSummaryVerificationInput = {
  exportId: string;
  format: "csv" | "printable";
  bytesBase64: string;
  expectedSha256: string;
  expectedBytes: number;
};
```

Implementasi boleh menggunakan nama prosedur berbeda selama semantik, guard, dan output tetap setara. Tidak diperbolehkan memasukkan raw storage key atau owner identifier sebagai authorization input dari client.

## 4. Server Processing Flow

### 4.1 Authorization

Setiap summary, export, dan verification procedure harus memakai `canAccessMonthlyReportArtifacts(ctx.user)`. Guard mensyaratkan authenticated user, role admin, dan open ID yang sama dengan configured project owner. Member, anonymous request, dan cross-scope request harus menghasilkan error authorization yang aman.

### 4.2 Range resolution

Server memanggil `resolveGovernanceAuditDateRange` atau resolver otoritatif yang sama untuk menghasilkan metadata range. Hasil minimal:

```ts
type ResolvedRange = {
  timezone: "Asia/Jakarta";
  startWib: Date;
  endWib: Date;
  startDate: string;
  endDate: string;
  preset: string | null;
  label: string;
};
```

`endDate` adalah tanggal kalender Jakarta inklusif, sedangkan `endWib` adalah midnight hari berikutnya eksklusif. Tidak ada `new Date()` browser yang dipakai untuk menentukan business boundary.

### 4.3 Dataset selection

Server mengambil artifact records melalui service existing dan menerapkan aturan berikut:

| Rule | Behavior |
|---|---|
| Owner scope | Hanya artifact scope owner yang sah |
| Production | Prefix/key harus memenuhi production-artifact rule; test/non-production excluded |
| Period | `generatedAt` atau period identity harus berada dalam resolved range sesuai semantik existing service |
| Lifecycle | Active records only; archived/retired excluded |
| Integrity | CSV/HTML/PDF availability harus healthy dan SHA-256/byte metadata cocok |
| Retention | Classifier Phase 2.22 menentukan normal/approaching/eligible |
| Ordering | Deterministic: year ascending, month ascending, lalu stable artifact identity |

Tidak boleh ada query kedua yang menerapkan cutoff atau warning window berbeda dari `classifyMonthlyReportArtifactRetention`.

### 4.4 Snapshot object

Output logical snapshot harus setara dengan:

```ts
type RetentionSummarySnapshot = {
  kind: "storeos_retention_summary";
  version: 1;
  generatedAt: Date;
  evaluatedAt: Date;
  timezone: "Asia/Jakarta";
  scope: {
    range: ResolvedRange;
    calendarPeriodCount: number;
  };
  policy: {
    retentionMonths: number;
    archiveWarningWindowDays: number;
  };
  summary: {
    activeArtifactCount: number;
    artifactTypeCounts: Record<"csv" | "html" | "pdf", number>;
    normalArtifactCount: number;
    approachingArtifactCount: number;
    eligibleArtifactCount: number;
    approachingArtifactTypeCounts: Record<"csv" | "html" | "pdf", number>;
    verifiedBundleCount: number;
    excludedBundleCount: number;
    oldestActiveArtifact: PeriodArtifact | null;
    newestActiveArtifact: PeriodArtifact | null;
    oldestApproachingArtifact: ApproachingArtifact | null;
    availabilityCounts: Record<"available" | "missing" | "corrupt" | "retired" | "archived", number>;
  };
  readOnly: true;
};
```

`generatedAt` menunjukkan waktu pembuatan output; `evaluatedAt` menunjukkan waktu classifier retensi dievaluasi. Keduanya harus serializable dan ditampilkan dalam WIB.

## 5. CSV Contract

CSV harus UTF-8 dengan BOM untuk compatibility spreadsheet. Header wajib stabil dan menggunakan nama yang terdokumentasi. Contoh header:

```text
kind,version,generatedAt,evaluatedAt,timezone,startDate,endDate,preset,calendarPeriodCount,retentionMonths,archiveWarningWindowDays,activeArtifactCount,csvCount,htmlCount,pdfCount,normalCount,approachingCount,eligibleCount,verifiedBundleCount,excludedBundleCount,oldestActiveYear,oldestActiveMonth,newestActiveYear,newestActiveMonth,oldestApproachingYear,oldestApproachingMonth,readOnly
```

Metadata summary dapat diwujudkan sebagai satu atau lebih baris, tetapi struktur harus deterministic, terdokumentasi, dan mudah diproses. Jika detail per periode disediakan, setiap field harus berasal dari dataset yang sama dan urutannya harus stabil. Semua cell wajib di-escape/quote dengan benar. Nilai Unicode, koma, newline, dan tanda kutip harus diuji.

## 6. Printable/PDF Contract

Printable output harus menampilkan:

1. Judul `StoreOS — Ringkasan Retensi Artefak`.
2. Scope, preset/custom origin, start/end date, dan timezone WIB.
3. `generatedAt` dan `evaluatedAt`.
4. Retention months dan warning days.
5. Active count, format counts, retention counts, integrity counts.
6. Oldest active, newest active, dan oldest approaching artifact bila tersedia.
7. Read-only statement.
8. Integrity metadata setelah bytes final tersedia.

Jika pipeline menghasilkan PDF, `format` harus `pdf` atau format yang eksplisit dan hash harus dihitung dari PDF bytes final. Jika pipeline menghasilkan printable HTML, metadata harus menyatakan `printable`/`html`; server tidak boleh menyebut HTML sebagai PDF.

## 7. Integrity Contract

Server memakai SHA-256 exact-byte calculation yang sudah digunakan governance export. Prosesnya adalah:

1. Build logical snapshot dari source-of-truth service.
2. Serialize ke final CSV atau printable/PDF bytes.
3. Hitung `byteSize = bytes.length`.
4. Hitung `sha256 = SHA256(bytes)`.
5. Bentuk deterministic `exportId` dari scope, format, version, dan hash atau pola identifier yang sudah disetujui.
6. Kembalikan bytes tanpa modifikasi setelah hashing.
7. Verification mengulang hash pada exact bytes dan membandingkan byte size serta hash.

Response metadata:

```ts
type RetentionSummaryExportMetadata = {
  exportId: string;
  format: "csv" | "printable";
  generatedAt: Date;
  evaluatedAt: Date;
  timezone: "Asia/Jakarta";
  scope: ResolvedRange;
  bytes: number;
  sha256: string;
  verificationStatus: "verified" | "hash_mismatch" | "unavailable";
};
```

Mismatch harus dikembalikan sebagai status eksplisit atau error terkontrol. Tidak boleh silently accept, auto-repair, mengunduh ulang dari sumber yang berbeda, atau mengubah artifact metadata.

## 8. Router and Error Contract

Router harus menyediakan prosedur owner-admin read-only untuk export dan verification. Nama prosedur dapat mengikuti konvensi Reports yang ada. Error code yang direkomendasikan:

| Condition | Code | Client behavior |
|---|---|---|
| Unauthenticated | UNAUTHORIZED | Tampilkan login/access state umum |
| Member or wrong owner | FORBIDDEN | Tampilkan owner-admin restriction |
| Invalid range/preset | BAD_REQUEST | Tampilkan input invalid, tanpa retry loop |
| No active records | OK with zero-count snapshot | Tampilkan empty export state |
| Integrity unavailable | PRECONDITION_FAILED | Jangan tampilkan file seolah sehat |
| Hash mismatch | PRECONDITION_FAILED | Tampilkan mismatch dan blokir trust indicator |
| Internal generation failure | INTERNAL_SERVER_ERROR | Tampilkan safe failure |

Tidak boleh mengembalikan storage credentials, raw S3 key, presigned URL internal, SQL details, atau owner scope internals.

## 9. Client Requirements

Client menggunakan tRPC query/mutation yang telah menjadi pola Reports. URL state Phase 2.19–2.22 tetap menjadi sumber filter UI; server tetap menjadi authority. Setelah export, client menyimpan metadata di state lokal halaman untuk menampilkan hasil, tetapi tidak memakai localStorage atau database persistence.

Komponen minimum:

| Component | Requirement |
|---|---|
| Export action group | CSV dan printable action, disabled saat loading |
| Metadata panel | format, scope, WIB timestamp, bytes, hash |
| Verification badge | verified, mismatch, unavailable |
| Copy hash | keyboard-accessible, full hash copied |
| Empty state | zero-count snapshot tetap jelas |
| Error state | auth, validation, integrity, generation dipisahkan |

## 10. Read-only and Mutation Invariants

Test suite harus memonitor bahwa export dan verification tidak memanggil:

- lifecycle transition atau archive mutation;
- artifact create/update/delete/retire;
- scheduler trigger atau scheduler configuration;
- `reports.monthlySummary` mutation, Financial Core, Inventory Intelligence, ledger, atau stock-opname mutation;
- QR issue/revoke/expiry/policy mutation;
- governance audit history atau receipt mutation.

Query boleh melakukan read dan checksum computation sesuai integrity contract. Tidak ada database migration yang dibutuhkan untuk fitur ini kecuali implementasi aktual menemukan kebutuhan yang secara eksplisit disetujui; export history persistence bukan bagian Phase 2.23.

## 11. Test Requirements

| Area | Required coverage |
|---|---|
| Resolver | Preset, custom range, Jakarta midnight, inclusive/exclusive boundaries |
| Dataset | Active/verified inclusion, archived/retired/missing/corrupt exclusion |
| Retention | Normal, approaching, eligible, exact cutoff and warning boundary |
| Determinism | Same fixture/input yields same record ordering and bytes |
| CSV | BOM, quoted fields, Unicode, byte count, SHA-256 |
| Printable/PDF | Same dataset, correct format metadata, non-empty and empty scopes |
| Tamper | One-byte change produces mismatch |
| Authorization | Owner-admin success, member denial, cross-scope denial |
| No mutation | Lifecycle and protected domain spies remain untouched |
| Browser | Download, metadata display, verification, empty/loading/error, URL context |
| Responsive | Desktop and mobile Reports layout |

## 12. Traceability Matrix

| Requirement | BRD | PRD | FRD |
|---|---|---|---|
| Read-only snapshot | Tujuan dan prinsip | P0 summary | Sections 4, 10 |
| WIB scope | Business principles | Scope/source of truth | Sections 3, 4 |
| CSV/printable output | Business need | P0/P1 export | Sections 5, 6 |
| Exact-byte integrity | Risk mitigation | P0 integrity | Section 7 |
| Owner-admin | Access governance | User model | Sections 3, 8 |
| No lifecycle mutation | Protected domains | Out of scope | Section 10 |
| Testability | Success metrics | Acceptance criteria | Section 11 |

## 13. Release Preconditions

Sebelum release, implementation harus memenuhi BRD dan PRD, semua test requirements lulus, `pnpm test`, `pnpm playwright test`, `pnpm check`, dan production build berhasil, serta desktop/mobile Reports dapat dirender. Checkpoint hanya boleh dibuat setelah todo checklist dokumentasi dan implementation checklist diverifikasi.

## 14. Internal References

FRD ini mengacu pada spesifikasi Phase 2.23 di `pasted_content_20.txt`, tipe dan classifier pada `server/monthlyReportArtifacts.ts`, resolver WIB pada `server/governanceAuditDateSearch.ts`, serta utility integrity pada `server/governanceAuditExportIntegrity.ts`.
