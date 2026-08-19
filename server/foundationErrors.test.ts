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
});
