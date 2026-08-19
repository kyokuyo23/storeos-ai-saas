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

export const settingsInput = z.object({
  businessName: requiredText("Nama bisnis wajib diisi."),
  storeLocation: requiredText("Lokasi toko wajib diisi."),
  currency: requiredText("Mata uang wajib diisi."),
  timezone: requiredText("Zona waktu wajib diisi."),
});
