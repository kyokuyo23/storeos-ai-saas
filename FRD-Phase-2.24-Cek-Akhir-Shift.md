# FRD — StoreOS Phase 2.24: Cek Akhir Shift

**Versi:** 1.0 · **Tanggal:** 13 Oktober 2026 · Mengacu: PRD-Phase-2.24-Cek-Akhir-Shift.md

## 1. Data

| Tabel/kolom | Isi |
|---|---|
| `ingredients.shiftCheck` | boolean, default false |
| `businessSettings.shiftOpeningCash` | Modal kas awal per shift (Rp), default 0 |
| `shiftChecks` | id, `reference` (SHC-…, unik), `status` (`matched`·`pending`·`approved`·`rejected`), `submittedByUserId`, `submittedByName`, `note`, `shiftStartedAt`, `submittedAt`, `reviewedByUserId`, `reviewedByName`, `reviewNote`, `reviewedAt`, `varianceItemCount`, `totalVarianceValue`, `saleCount`, `grossSales`, `voidRefundValue`, `netSales`, `openingCash`, `countedCash`, `countedNonCash`, `incomeVariance` |
| `shiftCheckItems` | id, `shiftCheckId`, `ingredientId`, `ingredientName`, `unit`, `openingQuantity`, `purchaseQuantity`, `usageQuantity`, `otherQuantity`, `systemQuantity`, `countedQuantity`, `variance` (= hitungan − seharusnya), `costPerUnit` |
| `shiftCheckPhotos` | id, `shiftCheckId`, `storageKey` (ke `storedObjects`), `contentType`, `byteSize` |

Nama dan harga di-snapshot agar riwayat tidak berubah bila master bahan diubah.

## 2. Prosedur server (tRPC `shiftCheck.*`)

| Prosedur | Akses | Perilaku |
|---|---|---|
| `items` | login | Bahan aktif bertanda: id, nama, satuan. **Tanpa saldo.** |
| `submit` | login | Validasi FR-03/FR-04; dalam satu transaksi: baca saldo, simpan cek, item, foto; status `matched` bila semua selisih 0, selain itu `pending` |
| `list` | login | Kasir: cek sendiri. Pemilik/admin sistem: semua. Filter status opsional, terbaru dahulu, maks. 100 |
| `get` | login | Detail + item + id foto; kasir hanya cek sendiri (FORBIDDEN selain itu) |
| `review` | pemilik/admin sistem | `{id, decision: approve|reject, note}`; hanya status `pending`; FR-07/FR-08; update bersyarat status=`pending` agar tidak dobel |
| `ingredient.setShiftCheck` | pemilik/admin sistem | Ubah tanda bahan |

Foto: `GET /api/shift-checks/photos/:photoId` — 401 tanpa login, 403 bila bukan pemilik/admin sistem/pengirim, `Cache-Control: private`.

## 3. Aturan perhitungan

- Pergerakan ledger sejak `shiftStartedAt` per bahan: `purchase` → pembelian; `sale`, `exchange_sale`, `void`, `refund`, `partial_refund`, `exchange_return` → terpakai (bersih); lainnya → lain-lain. `openingQuantity = systemQuantity − pembelian + terpakai − lain-lain` (systemQuantity = saldo saat cek dikirim).
- Pemasukan: penjualan dengan `completedAt` dalam periode shift diringkas dengan Financial Core (`netSales` = pendapatan bersih). `incomeVariance = (countedCash − openingCash + countedNonCash) − netSales`.
- Status `pending` bila ada selisih stok **atau** `incomeVariance ≠ 0`.
- `variance = round(counted − system, 3)`; dianggap selisih bila ≠ 0.
- `varianceValue = variance × costPerUnit` (Rupiah, 2 desimal).
- Persetujuan: untuk setiap item dengan selisih, `saldo_baru = saldo_saat_ini + variance`; bila < 0 → BAD_REQUEST "lakukan stock opname penuh". Pergerakan `opname` dengan catatan `Cek akhir shift SHC-… disetujui oleh <nama>`.

## 4. Error

| Kondisi | Kode | Pesan |
|---|---|---|
| Belum ada bahan bertanda | BAD_REQUEST | Belum ada bahan yang ditandai untuk cek akhir shift. |
| Bahan kurang/berlebih/duplikat | BAD_REQUEST | Hitung semua bahan cek shift tepat satu kali. |
| Foto tidak valid | BAD_REQUEST | Lampirkan 1–3 foto JPG/PNG/WebP maks. 1,5 MB. |
| Bukan pemilik/admin sistem | FORBIDDEN | — |
| Meninjau cek sendiri | FORBIDDEN | Cek yang Anda kirim harus ditinjau orang lain. |
| Sudah ditinjau | CONFLICT | Cek ini sudah ditinjau. |

## 5. Pengujian

Unit/router: perhitungan selisih, status otomatis, otorisasi per peran, blind count (tanpa saldo), validasi foto, review sekali, larangan meninjau sendiri, saldo negatif. Browser: kirim cek dari HP dengan foto, peninjauan dengan foto, alert.
