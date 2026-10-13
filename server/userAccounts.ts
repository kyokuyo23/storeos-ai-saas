/**
 * Member (staff) accounts. The owner-admin logs in with OWNER_PASSWORD; members get their own
 * username + password, created and managed by the owner. Passwords are stored as scrypt hashes.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { z } from "zod";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
});

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
export const MIN_MEMBER_PASSWORD_LENGTH = 8;
/** Usernames the owner logs in with; never assignable to a member. */
export const OWNER_USERNAMES = ["pemilik", "owner"] as const;
const RESERVED_USERNAMES = new Set<string>([...OWNER_USERNAMES, "admin", "root", "system"]);

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { ...SCRYPT, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Constant-time check against a stored `scrypt$N$r$p$salt$hash` string; false for anything malformed. */
export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (typeof password !== "string" || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0) || N > 1 << 20) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!salt.length || expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 2 });
  return timingSafeEqual(actual, expected);
}

export const normalizeUsername = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
export const isOwnerUsername = (value: unknown) => (OWNER_USERNAMES as readonly string[]).includes(normalizeUsername(value));

const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Nama pengguna 3–32 karakter: huruf kecil, angka, titik, minus, atau garis bawah.")
  .refine((value) => !RESERVED_USERNAMES.has(value), "Nama pengguna ini dicadangkan. Pilih nama lain.");
const passwordSchema = z.string()
  .min(MIN_MEMBER_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_MEMBER_PASSWORD_LENGTH} karakter.`)
  .max(128, "Kata sandi maksimal 128 karakter.")
  .refine((value) => value.trim() === value, "Kata sandi tidak boleh diawali atau diakhiri spasi.");

export const memberCreateInput = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(80),
  username: usernameSchema,
  password: passwordSchema,
});
export const memberPasswordInput = z.object({ id: z.number().int().positive(), password: passwordSchema });
export const memberActiveInput = z.object({ id: z.number().int().positive(), isActive: z.boolean() });

/** Fields of a user that are safe to send to the browser (never the password hash). */
export function publicUser<T extends { id: number; openId: string; name: string | null; email?: string | null; role: string; username?: string | null; isActive?: boolean; lastSignedIn: Date }>(user: T, ownerOpenId: string) {
  const isOwner = Boolean(ownerOpenId) && user.role === "admin" && user.openId === ownerOpenId;
  return { id: user.id, openId: user.openId, name: user.name, email: user.email ?? null, role: user.role, username: user.username ?? null, isActive: user.isActive ?? true, lastSignedIn: user.lastSignedIn, isOwner };
}
