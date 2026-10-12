import { describe, expect, it } from "vitest";
import { mapFoundationError } from "./foundationErrors";

describe("StoreOS foundation database error mapping", () => {
  it("maps duplicate values to a clear Indonesian conflict message", () => {
    const error = mapFoundationError({ code: "ER_DUP_ENTRY" }, "Produk");
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("Produk sudah ada");
  });
  it("maps invalid foreign keys to a validation-style error", () => {
    const error = mapFoundationError({ errno: 1452 }, "Resep");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toContain("Referensi resep tidak valid");
  });
  it("maps unavailable databases to a retryable service message", () => {
    const error = mapFoundationError(new Error("Database tidak tersedia. Silakan coba lagi."), "Pengaturan");
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });
  it("maps unexpected database failures to a clear generic Indonesian message", () => {
    const error = mapFoundationError(new Error("connection reset"), "Bahan");
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("Bahan gagal disimpan. Silakan coba lagi.");
  });
  it("unwraps drizzle-wrapped driver errors (cause) so duplicates and FK failures keep their meaning", () => {
    const duplicate = mapFoundationError(Object.assign(new Error("Failed query: insert into categories"), { cause: { code: "ER_DUP_ENTRY", errno: 1062 } }), "Kategori");
    expect(duplicate.code).toBe("CONFLICT");
    const foreignKey = mapFoundationError(Object.assign(new Error("Failed query"), { cause: { errno: 1452 } }), "Resep");
    expect(foreignKey.code).toBe("BAD_REQUEST");
    expect(mapFoundationError(Object.assign(new Error("Failed query"), { cause: new Error("socket hang up") }), "Bahan").code).toBe("INTERNAL_SERVER_ERROR");
  });
  it("maps negative-stock and opname input errors to a clear client error", () => {
    expect(mapFoundationError(new Error("Stok tidak boleh menjadi negatif."), "Pergerakan stok").code).toBe("BAD_REQUEST");
    expect(mapFoundationError(new Error("Bahan tidak boleh dihitung lebih dari satu kali."), "Stock opname").code).toBe("BAD_REQUEST");
  });
});
