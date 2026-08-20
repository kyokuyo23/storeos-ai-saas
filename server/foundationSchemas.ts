import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);
const numberInput = (message: string) => z.coerce.number({ message }).finite(message).min(0, message);

export const categoryInput = z.object({
  name: requiredText("Nama kategori wajib diisi."),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const productInput = z.object({
  categoryId: z.coerce.number().int().positive("Kategori wajib dipilih."),
  name: requiredText("Nama produk wajib diisi."),
  sku: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  sellingPrice: numberInput("Harga jual harus berupa angka."),
  costPrice: numberInput("Harga modal harus berupa angka."),
  unit: requiredText("Satuan wajib diisi."),
  isActive: z.boolean().default(true),
});

export const ingredientInput = z.object({
  name: requiredText("Nama bahan wajib diisi."),
  unit: requiredText("Satuan wajib diisi."),
  costPerUnit: numberInput("Harga per satuan harus berupa angka."),
  minimumStock: numberInput("Stok minimum harus berupa angka."),
  isActive: z.boolean().default(true),
});

export const stockMovementInput = z.object({
  ingredientId: z.coerce.number().int().positive("Bahan wajib dipilih."),
  type: z.enum(["purchase", "adjustment", "waste", "opname"]),
  quantity: z.coerce.number({ message: "Jumlah stok harus berupa angka." }).finite("Jumlah stok harus berupa angka."),
  note: z.string().trim().max(1000).optional().nullable(),
}).superRefine((input, context) => {
  if ((input.type === "purchase" || input.type === "waste") && input.quantity <= 0) context.addIssue({ code: "custom", path: ["quantity"], message: "Jumlah harus lebih dari nol." });
  if (input.type === "adjustment" && input.quantity === 0) context.addIssue({ code: "custom", path: ["quantity"], message: "Penyesuaian tidak boleh bernilai nol." });
  if (input.type === "opname" && input.quantity < 0) context.addIssue({ code: "custom", path: ["quantity"], message: "Hasil stok opname tidak boleh negatif." });
});

export const stockOpnameBatchInput = z.object({
  counts: z.array(z.object({
    ingredientId: z.coerce.number().int().positive("Bahan wajib dipilih."),
    physicalQuantity: z.coerce.number({ message: "Jumlah fisik harus berupa angka." }).finite("Jumlah fisik harus berupa angka.").min(0, "Jumlah fisik tidak boleh negatif."),
  })).min(1, "Tambahkan setidaknya satu hasil hitung fisik."),
  note: z.string().trim().max(1000).optional().nullable(),
}).superRefine((input, context) => {
  const used = new Set<number>();
  input.counts.forEach((count, index) => {
    if (used.has(count.ingredientId)) context.addIssue({ code: "custom", path: ["counts", index, "ingredientId"], message: "Bahan tidak boleh dihitung lebih dari satu kali." });
    used.add(count.ingredientId);
  });
});

export const stockOpnameHistoryInput = z.object({
  reference: z.string().trim().max(100, "Nomor referensi audit terlalu panjang.").optional(),
});

export const stockOpnameFollowUpInput = z.object({
  reference: requiredText("Nomor referensi audit wajib diisi.").max(80, "Nomor referensi audit terlalu panjang."),
  status: z.enum(["needs_follow_up", "in_progress", "resolved"]),
});

export const stockOpnameFollowUpNoteInput = z.object({
  reference: requiredText("Nomor referensi audit wajib diisi.").max(80, "Nomor referensi audit terlalu panjang."),
  note: z.string().trim().max(1000, "Catatan tindak lanjut maksimal 1000 karakter.").optional().nullable(),
});

export const recipeInput = z.object({
  productId: z.coerce.number().int().positive("Produk wajib dipilih."),
  name: requiredText("Nama resep wajib diisi."),
  items: z.array(z.object({
    ingredientId: z.coerce.number().int().positive("Bahan resep wajib dipilih."),
    quantity: z.coerce.number().finite("Jumlah resep harus berupa angka.").positive("Jumlah resep harus lebih dari nol."),
  })).min(1, "Tambahkan setidaknya satu bahan resep."),
});

export const saleCompletionInput = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive("Produk wajib dipilih."),
    quantity: z.coerce.number().int().positive("Jumlah penjualan harus lebih dari nol."),
  })).min(1, "Tambahkan setidaknya satu produk ke keranjang."),
});

export const saleReversalInput = z.object({
  saleId: z.coerce.number().int().positive("Transaksi wajib dipilih."),
  type: z.enum(["void", "refund"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const partialRefundInput = z.object({
  saleId: z.coerce.number().int().positive("Transaksi wajib dipilih."),
  saleItemId: z.coerce.number().int().positive("Item penjualan wajib dipilih."),
  quantity: z.coerce.number().int().positive("Jumlah refund harus lebih dari nol."),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const exchangeInput = z.object({
  saleId: z.coerce.number().int().positive("Transaksi wajib dipilih."),
  saleItemId: z.coerce.number().int().positive("Item penjualan wajib dipilih."),
  returnedQuantity: z.coerce.number().int().positive("Jumlah item yang dikembalikan harus lebih dari nol."),
  replacementItems: z.array(z.object({
    productId: z.coerce.number().int().positive("Produk pengganti wajib dipilih."),
    quantity: z.coerce.number().int().positive("Jumlah produk pengganti harus lebih dari nol."),
  })).min(1, "Tambahkan setidaknya satu produk pengganti."),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const exchangeSettlementInput = z.object({
  exchangeId: z.coerce.number().int().positive("Penukaran wajib dipilih."),
  paymentMethod: z.enum(["cash", "card"]),
});

const jakartaDateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus memakai format YYYY-MM-DD.");
const isValidCalendarDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validateJakartaDateRange = (input: { startDate?: string; endDate?: string }, context: z.RefinementCtx) => {
  if (Boolean(input.startDate) !== Boolean(input.endDate)) context.addIssue({ code: "custom", path: [input.startDate ? "endDate" : "startDate"], message: "Tanggal mulai dan akhir harus diisi bersama." });
  if (input.startDate && !isValidCalendarDate(input.startDate)) context.addIssue({ code: "custom", path: ["startDate"], message: "Tanggal mulai tidak valid." });
  if (input.endDate && !isValidCalendarDate(input.endDate)) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal akhir tidak valid." });
  if (input.startDate && input.endDate && input.startDate > input.endDate) context.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai." });
};

export const settlementDateRangeInput = z.object({
  startDate: jakartaDateInput.optional(),
  endDate: jakartaDateInput.optional(),
}).superRefine(validateJakartaDateRange);

export const inventoryIntelligenceInput = z.object({
  startDate: jakartaDateInput.optional(),
  endDate: jakartaDateInput.optional(),
}).superRefine(validateJakartaDateRange);

export const inventoryMovementDrillDownInput = z.object({
  ingredientId: z.coerce.number().int().positive("Bahan wajib dipilih."),
  startDate: jakartaDateInput.optional(),
  endDate: jakartaDateInput.optional(),
}).superRefine(validateJakartaDateRange);

export const productFinancialInput = z.object({
  productId: z.coerce.number().int().positive("Produk wajib dipilih."),
  startDate: jakartaDateInput.optional(),
  endDate: jakartaDateInput.optional(),
}).superRefine(validateJakartaDateRange);

export const settingsInput = z.object({
  businessName: requiredText("Nama bisnis wajib diisi."),
  storeLocation: requiredText("Lokasi toko wajib diisi."),
  currency: requiredText("Mata uang wajib diisi."),
  timezone: requiredText("Zona waktu wajib diisi."),
  opnameWarningAgeDays: z.coerce.number({ message: "Ambang peringatan harus berupa angka." }).int("Ambang peringatan harus berupa bilangan bulat.").min(1, "Ambang peringatan minimal 1 hari.").max(365, "Ambang peringatan maksimal 365 hari."),
  opnameCriticalAgeDays: z.coerce.number({ message: "Ambang mendesak harus berupa angka." }).int("Ambang mendesak harus berupa bilangan bulat.").min(2, "Ambang mendesak minimal 2 hari.").max(365, "Ambang mendesak maksimal 365 hari."),
  inventoryVarianceAbsoluteTolerance: z.coerce.number({ message: "Toleransi absolut harus berupa angka." }).finite("Toleransi absolut harus berupa angka.").min(0, "Toleransi absolut tidak boleh negatif.").max(1000000, "Toleransi absolut terlalu besar."),
  inventoryVariancePercentageTolerance: z.coerce.number({ message: "Toleransi persentase harus berupa angka." }).finite("Toleransi persentase harus berupa angka.").min(0, "Toleransi persentase tidak boleh negatif.").max(100, "Toleransi persentase maksimal 100%."),
}).superRefine((input, context) => {
  if (input.opnameCriticalAgeDays <= input.opnameWarningAgeDays) context.addIssue({ code: "custom", path: ["opnameCriticalAgeDays"], message: "Ambang mendesak harus lebih besar dari ambang peringatan." });
});
