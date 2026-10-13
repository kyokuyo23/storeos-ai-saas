# BRD — StoreOS Phase 2.24: Cek Akhir Shift (Anti-Fraud Kasir)

**Versi:** 1.0 · **Tanggal:** 13 Oktober 2026 · **Status:** Draft untuk persetujuan pemilik

## 1. Latar belakang

StoreOS sudah memotong stok bahan otomatis dari resep setiap penjualan, dan memiliki stock opname serta analisis varians bulanan. Namun selisih stok baru terlihat saat opname besar dilakukan, sehingga sulit mengetahui **shift mana dan kasir siapa** yang menyebabkan selisih. Barang bernilai tinggi dan mudah hilang (gelas cup, sachet, gula, susu, kopi) perlu dicek lebih sering.

## 2. Masalah bisnis

| Masalah | Dampak | Kebutuhan |
|---|---|---|
| Selisih stok tidak dapat ditelusuri ke shift/kasir | Fraud (penjualan tanpa input, barang dibawa pulang) tidak terdeteksi | Hitung fisik barang kunci di setiap akhir shift, tercatat atas nama kasir |
| Hitung fisik bisa dimanipulasi agar cocok dengan sistem | Selisih disembunyikan | Hitung **tanpa melihat angka sistem** (blind count) + **foto bukti** |
| Penyesuaian stok bisa dilakukan sepihak | Kasir menutupi selisih sendiri | Selisih **wajib disetujui** pemilik/admin sistem sebelum stok berubah |

## 3. Tujuan

1. Setiap akhir shift, kasir menghitung barang yang ditandai pemilik dan mengunggah 1–3 foto bukti.
2. Sistem membandingkan hitungan dengan saldo sistem dan menghitung selisih (jumlah dan Rupiah) per kasir.
3. Selisih tidak mengubah stok sampai disetujui pemilik/admin sistem; keputusan tercatat (siapa, kapan, catatan).
4. Cek yang menunggu persetujuan muncul di Alerts.

## 4. Ruang lingkup

**Termasuk:** tanda "Cek akhir shift" per bahan, form hitung blind, foto 1–3 per cek, penyimpanan foto di database, riwayat cek, persetujuan/penolakan, penyesuaian stok saat disetujui, alert, otorisasi per peran.

**Tidak termasuk (phase berikutnya):** buka/tutup shift dan setoran kas, persetujuan void/refund, pencatatan kasir di setiap transaksi penjualan, log aktivitas umum, menyembunyikan saldo Inventory dari kasir, multi-toko.

## 5. Pemangku kepentingan

| Peran | Kepentingan |
|---|---|
| Pemilik | Deteksi kehilangan per shift/kasir, bukti foto, kendali penyesuaian stok |
| Admin sistem | Meninjau dan menyetujui cek atas nama pemilik |
| Kasir | Proses cek cepat (< 3 menit) dari HP |

## 6. Risiko

| Risiko | Mitigasi |
|---|---|
| Kasir melihat saldo di Inventory lalu menyalin angka | Form tidak menampilkan saldo; pembatasan Inventory untuk kasir dijadwalkan di phase berikutnya |
| Foto besar memperlambat/menolak upload | Foto dikompres di HP (maks. 1600 px, JPEG) sebelum dikirim |
| Peninjau menyetujui ceknya sendiri | Admin sistem tidak boleh meninjau cek yang ia kirim sendiri |
| Penjualan terjadi antara cek dan persetujuan | Persetujuan menerapkan **selisih** (bukan menimpa saldo), sehingga penjualan sesudahnya tetap benar |

## 7. Ukuran keberhasilan

| Ukuran | Target |
|---|---|
| Cek akhir shift tersimpan dengan foto dan nama kasir | 100% |
| Selisih mengubah stok tanpa persetujuan | 0 kejadian |
| Kasir dapat melihat saldo sistem di form cek | Tidak |

## 8. Persetujuan

| Peran | Nama | Status | Tanggal |
|---|---|---|---|
| Product owner |  | Pending |  |
