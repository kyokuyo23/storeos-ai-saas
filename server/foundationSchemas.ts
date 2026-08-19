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

export const recipeInput = z.object({
  productId: z.coerce.number().int().positive("Produk wajib dipilih."),
  name: requiredText("Nama resep wajib diisi."),
  items: z.array(z.object({
    ingredientId: z.coerce.number().int().positive("Bahan resep wajib dipilih."),
    quantity: z.coerce.number().finite("Jumlah resep harus berupa angka.").positive("Jumlah resep harus lebih dari nol."),
  })).min(1, "Tambahkan setidaknya satu bahan resep."),
});

export const settingsInput = z.object({
  businessName: requiredText("Nama bisnis wajib diisi."),
  storeLocation: requiredText("Lokasi toko wajib diisi."),
  currency: requiredText("Mata uang wajib diisi."),
  timezone: requiredText("Zona waktu wajib diisi."),
});
