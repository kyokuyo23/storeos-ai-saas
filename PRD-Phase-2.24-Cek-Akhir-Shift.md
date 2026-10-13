# PRD — StoreOS Phase 2.24: Cek Akhir Shift

**Versi:** 1.0 · **Tanggal:** 13 Oktober 2026 · Mengacu: BRD-Phase-2.24-Cek-Akhir-Shift.md

## 1. Ringkasan

Menu baru **Cek Shift**. Di akhir shift, kasir menghitung barang kunci yang ditandai pemilik (mis. gelas cup, sachet, gula), memotret 1–3 foto bukti, lalu mengirim. Sistem mencatat selisih terhadap saldo sistem. Bila ada selisih, cek berstatus **Menunggu persetujuan** dan stok baru disesuaikan setelah pemilik/admin sistem menyetujui.

### Rumus rekonsiliasi (otomatis)

**Stok**, per barang, dalam qty dan Rupiah (× harga per satuan):

`Stok awal shift + Pembelian − Terpakai (penjualan, bersih dari void/refund/tukar) ± Lain-lain (waste/penyesuaian/opname) = Stok akhir seharusnya`

`Selisih = Hitungan fisik − Stok akhir seharusnya`

**Pemasukan**:

`Seharusnya = Penjualan bersih shift` · `Diterima = Uang tunai di laci − Modal kas awal + Non-tunai (EDC/QRIS/transfer)` · `Selisih pemasukan = Diterima − Seharusnya`

Periode shift = sejak cek akhir shift sebelumnya (atau 00:00 WIB hari itu bila belum ada) sampai cek dikirim. Modal kas awal diatur pemilik/admin sistem di Settings. POS belum mencatat metode bayar per transaksi, sehingga pemasukan dicocokkan secara total (tunai + non-tunai).

## 2. Pengguna dan akses

| Aksi | Kasir | Admin sistem | Pemilik |
|---|---|---|---|
| Mengirim cek akhir shift | ✅ | ✅ | ✅ |
| Melihat riwayat cek | Milik sendiri | Semua | Semua |
| Melihat saldo sistem & selisih | Setelah dikirim, cek sendiri | ✅ | ✅ |
| Menyetujui / menolak | ❌ | ✅ (kecuali cek sendiri) | ✅ |
| Menandai bahan "Cek akhir shift" | ❌ | ✅ | ✅ |
| Melihat foto bukti | Cek sendiri | ✅ | ✅ |

Semua aturan akses ditegakkan di server.

## 3. Alur

### 3.1 Pemilik menandai barang
Inventory → Saldo Bahan → kolom **Cek shift** → centang bahan yang wajib dihitung tiap akhir shift. Hanya bahan aktif yang ikut.

### 3.2 Kasir mengirim cek
1. Buka **Cek Shift**. Form menampilkan daftar bahan bertanda beserta satuannya, **tanpa saldo sistem** (blind count).
2. Isi jumlah fisik setiap bahan (wajib semua, ≥ 0), lalu uang tunai di laci dan total non-tunai.
3. Ambil/unggah **1–3 foto** (kamera HP didukung). Foto dikompres otomatis.
4. Catatan opsional, lalu **Kirim cek**.
5. Hasil: referensi `SHC-…`, status, dan ringkasan selisih.

### 3.3 Status
| Status | Arti |
|---|---|
| Sesuai | Semua hitungan stok dan pemasukan sesuai; selesai otomatis, stok tidak berubah |
| Menunggu persetujuan | Ada selisih stok atau pemasukan; stok belum berubah; muncul di Alerts |
| Disetujui | Selisih diterapkan ke stok sebagai pergerakan "Stock opname" dengan referensi cek |
| Ditolak | Stok tidak berubah; alasan wajib diisi |

### 3.4 Peninjauan
Pemilik/admin sistem membuka cek: tabel bahan (saldo sistem saat dikirim, hitungan, selisih jumlah & Rupiah), foto (bisa diperbesar), nama kasir, waktu WIB, catatan. Pilih **Setujui** (catatan opsional) atau **Tolak** (catatan wajib).

## 4. Persyaratan fungsional ringkas

| ID | Persyaratan |
|---|---|
| FR-01 | Bahan memiliki atribut `Cek akhir shift` (default tidak), hanya dapat diubah pemilik/admin sistem |
| FR-02 | Form cek tidak mengirim saldo sistem ke browser sebelum cek dikirim |
| FR-03 | Cek wajib mencakup semua bahan aktif bertanda, tanpa duplikat |
| FR-04 | Wajib 1–3 foto, JPEG/PNG/WebP, maks. 1,5 MB per foto setelah kompresi, total ≤ 3,5 MB |
| FR-05 | Saldo sistem di-snapshot pada saat cek dikirim, di dalam transaksi database |
| FR-06 | Cek mencatat pengirim (akun, nama) dan waktu; peninjauan mencatat peninjau, waktu, keputusan, catatan |
| FR-07 | Persetujuan menerapkan selisih sebagai pergerakan stok `opname`; ditolak bila saldo akan menjadi negatif |
| FR-08 | Cek hanya dapat ditinjau sekali; admin sistem tidak dapat meninjau cek yang dikirimnya sendiri |
| FR-09 | Alerts menampilkan jumlah cek menunggu persetujuan (peringatan; mendesak bila > 24 jam) |
| FR-10 | Selisih Rupiah = selisih × harga per satuan bahan saat cek dikirim |
| FR-11 | Rincian per barang: stok awal, pembelian, terpakai, lain-lain, seharusnya, fisik, selisih (qty & Rupiah) |
| FR-12 | Rekonsiliasi pemasukan: transaksi, penjualan kotor, void/refund, penjualan bersih, modal kas, tunai, non-tunai, diterima, selisih |

## 5. Kriteria penerimaan

| ID | Kriteria |
|---|---|
| AC-01 | Kasir mengirim cek dengan 1–3 foto; tanpa foto atau > 3 foto ditolak |
| AC-02 | Respons form cek kasir tidak memuat saldo sistem |
| AC-03 | Cek tanpa selisih berstatus Sesuai dan stok tidak berubah |
| AC-04 | Cek dengan selisih tidak mengubah stok sampai disetujui |
| AC-05 | Persetujuan menambah pergerakan opname sebesar selisih; penolakan tidak mengubah stok |
| AC-06 | Kasir tidak dapat meninjau, menandai bahan, atau melihat cek/foto kasir lain |
| AC-07 | Admin sistem tidak dapat meninjau ceknya sendiri; cek tidak dapat ditinjau dua kali |
| AC-08 | Cek menunggu persetujuan muncul di Alerts |
