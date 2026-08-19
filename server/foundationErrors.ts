import { TRPCError } from "@trpc/server";

type DatabaseErrorLike = { code?: string; errno?: number; message?: string };

export function mapFoundationError(error: unknown, entity: string): TRPCError {
  if (error instanceof TRPCError) return error;
  const databaseError = error as DatabaseErrorLike;
  if (databaseError.code === "ER_DUP_ENTRY" || databaseError.errno === 1062) {
    return new TRPCError({ code: "CONFLICT", message: `${entity} sudah ada atau menggunakan SKU yang sama.` });
  }
  if (databaseError.code === "ER_NO_REFERENCED_ROW_2" || databaseError.errno === 1452) {
    return new TRPCError({ code: "BAD_REQUEST", message: `Referensi ${entity.toLowerCase()} tidak valid. Silakan periksa data yang dipilih.` });
  }
  if (databaseError.message === "Bahan tidak ditemukan.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Bahan tidak ditemukan. Pilih bahan yang tersedia." });
  }
  if (databaseError.message === "Produk belum memiliki resep.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Produk belum memiliki resep yang dapat digunakan untuk penjualan." });
  }
  if (databaseError.message === "Bahan resep tidak ditemukan.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Salah satu bahan resep tidak tersedia. Periksa resep produk." });
  }
  if (databaseError.message?.startsWith("Stok bahan tidak mencukupi:")) {
    return new TRPCError({ code: "BAD_REQUEST", message: databaseError.message });
  }
  if (databaseError.message === "Produk tidak tersedia.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Produk tidak tersedia atau tidak aktif untuk dijual." });
  }
  if (databaseError.message === "Bahan resep tidak aktif.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Bahan resep tidak aktif. Aktifkan bahan atau perbarui resep sebelum menjual produk." });
  }
  if (databaseError.message === "Penjualan tidak ditemukan.") {
    return new TRPCError({ code: "NOT_FOUND", message: "Transaksi penjualan tidak ditemukan." });
  }
  if (databaseError.message === "Transaksi sudah dibatalkan atau direfund.") {
    return new TRPCError({ code: "CONFLICT", message: "Transaksi ini sudah dibatalkan atau direfund dan tidak dapat diproses ulang." });
  }
  if (databaseError.message === "Catatan pengurangan stok tidak ditemukan.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Catatan pengurangan stok transaksi tidak ditemukan sehingga stok tidak dapat dipulihkan." });
  }
  if (databaseError.message === "Baris penjualan tidak ditemukan.") {
    return new TRPCError({ code: "NOT_FOUND", message: "Item penjualan tidak ditemukan pada transaksi ini." });
  }
  if (databaseError.message === "Catatan resep penjualan tidak ditemukan.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Catatan resep untuk item penjualan tidak ditemukan sehingga stok tidak dapat dipulihkan." });
  }
  if (databaseError.message?.startsWith("Jumlah refund melebihi sisa item")) {
    return new TRPCError({ code: "BAD_REQUEST", message: databaseError.message });
  }
  if (databaseError.message === "Produk pengganti belum memiliki resep.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Produk pengganti belum memiliki resep yang lengkap untuk diproses sebagai penukaran." });
  }
  if (databaseError.message?.startsWith("Jumlah penukaran melebihi sisa item")) {
    return new TRPCError({ code: "BAD_REQUEST", message: databaseError.message });
  }
  if (databaseError.message === "Penukaran tidak ditemukan.") {
    return new TRPCError({ code: "NOT_FOUND", message: "Catatan penukaran tidak ditemukan." });
  }
  if (databaseError.message === "Penukaran ini tidak memerlukan tambahan pembayaran.") {
    return new TRPCError({ code: "BAD_REQUEST", message: "Penukaran ini tidak memiliki tambahan pembayaran yang perlu dicatat." });
  }
  if (databaseError.message === "Pembayaran tambahan penukaran sudah dicatat.") {
    return new TRPCError({ code: "CONFLICT", message: "Tambahan pembayaran untuk penukaran ini sudah dicatat." });
  }
  if (databaseError.message?.startsWith("Stok bahan tidak mencukupi:")) {
    return new TRPCError({ code: "BAD_REQUEST", message: databaseError.message });
  }
  if (databaseError.message?.includes("Database tidak tersedia")) {
    return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database tidak tersedia. Silakan coba lagi." });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${entity} gagal disimpan. Silakan coba lagi.` });
}
