import { count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { businessSettings, categories, ingredients, InsertUser, products, recipeItems, recipes, saleItems, sales, stockMovements, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { z } from "zod";
import type { categoryInput, ingredientInput, productInput, recipeInput, saleCompletionInput, settingsInput, stockMovementInput } from "./foundationSchemas";
import { resolveStockMovement } from "./inventory";
import { planRecipeDeductions } from "./sales";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function listCategories() { return (await requireDb()).select().from(categories).orderBy(categories.name); }
export async function createCategory(input: z.infer<typeof categoryInput>) {
  const db = await requireDb();
  const result = await db.insert(categories).values({ name: input.name, description: input.description || null });
  return (await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1))[0];
}
export async function listProducts() {
  const db = await requireDb();
  return db.select({ id: products.id, categoryId: products.categoryId, categoryName: categories.name, name: products.name, sku: products.sku, description: products.description, sellingPrice: products.sellingPrice, costPrice: products.costPrice, unit: products.unit, isActive: products.isActive, createdAt: products.createdAt, updatedAt: products.updatedAt }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt));
}
export async function createProduct(input: z.infer<typeof productInput>) {
  const db = await requireDb();
  return Number((await db.insert(products).values({ ...input, sku: input.sku || null, description: input.description || null }))[0].insertId);
}
export async function updateProduct(id: number, input: z.infer<typeof productInput>) {
  await (await requireDb()).update(products).set({ ...input, sku: input.sku || null, description: input.description || null }).where(eq(products.id, id));
}
export async function listIngredients() { return (await requireDb()).select().from(ingredients).orderBy(ingredients.name); }
export async function createIngredient(input: z.infer<typeof ingredientInput>) { return Number((await (await requireDb()).insert(ingredients).values(input))[0].insertId); }
export async function updateIngredient(id: number, input: z.infer<typeof ingredientInput>) { await (await requireDb()).update(ingredients).set(input).where(eq(ingredients.id, id)); }
export async function listStockMovements() {
  const db = await requireDb();
  return db.select({ id: stockMovements.id, ingredientId: stockMovements.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, saleId: stockMovements.saleId, saleReceiptNumber: sales.receiptNumber, type: stockMovements.type, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, note: stockMovements.note, occurredAt: stockMovements.occurredAt }).from(stockMovements).innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id)).leftJoin(sales, eq(stockMovements.saleId, sales.id)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
}
export async function recordStockMovement(input: z.infer<typeof stockMovementInput>) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const ingredient = (await tx.select().from(ingredients).where(eq(ingredients.id, input.ingredientId)).limit(1))[0];
    if (!ingredient) throw new Error("Bahan tidak ditemukan.");
    const movement = resolveStockMovement(ingredient.currentStock, input);
    await tx.update(ingredients).set({ currentStock: movement.balanceAfter }).where(eq(ingredients.id, ingredient.id));
    const result = await tx.insert(stockMovements).values({ ingredientId: ingredient.id, type: input.type, quantityDelta: movement.quantityDelta, balanceAfter: movement.balanceAfter, note: input.note || null });
    return { id: Number(result[0].insertId), ...movement };
  });
}
export async function listRecipes() {
  const db = await requireDb();
  const recipeRows = await db.select({ id: recipes.id, productId: recipes.productId, productName: products.name, name: recipes.name, updatedAt: recipes.updatedAt }).from(recipes).innerJoin(products, eq(recipes.productId, products.id)).orderBy(desc(recipes.updatedAt));
  const items = await db.select({ recipeId: recipeItems.recipeId, ingredientId: recipeItems.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, quantity: recipeItems.quantity }).from(recipeItems).innerJoin(ingredients, eq(recipeItems.ingredientId, ingredients.id));
  return recipeRows.map((recipe) => ({ ...recipe, items: items.filter((item) => item.recipeId === recipe.id) }));
}
export async function saveRecipe(input: z.infer<typeof recipeInput>) {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(recipes).where(eq(recipes.productId, input.productId)).limit(1);
    const recipeId = existing[0]?.id;
    if (recipeId) { await tx.update(recipes).set({ name: input.name }).where(eq(recipes.id, recipeId)); await tx.delete(recipeItems).where(eq(recipeItems.recipeId, recipeId)); }
    const activeRecipeId = recipeId ?? Number((await tx.insert(recipes).values({ productId: input.productId, name: input.name }))[0].insertId);
    await tx.insert(recipeItems).values(input.items.map((item) => ({ recipeId: activeRecipeId, ingredientId: item.ingredientId, quantity: item.quantity })));
  });
}

export async function completeSaleInTransaction(tx: any, input: z.infer<typeof saleCompletionInput>, receiptNumber = `TRX-${Date.now()}-${nanoid(5).toUpperCase()}`) {
    const quantityByProduct = new Map<number, number>();
    input.items.forEach((item) => quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity));
    const lines = Array.from(quantityByProduct, ([productId, quantity]) => ({ productId, quantity }));
    const productIds = lines.map((line) => line.productId);
    const productRows = await tx.select().from(products).where(inArray(products.id, productIds)) as Array<{ id: number; sellingPrice: number; isActive: boolean }>;
    if (productRows.length !== productIds.length || productRows.some((product) => !product.isActive)) throw new Error("Produk tidak tersedia.");

    const recipeRows = await tx.select().from(recipes).where(inArray(recipes.productId, productIds)) as Array<{ id: number; productId: number }>;
    if (recipeRows.length !== productIds.length) throw new Error("Produk belum memiliki resep.");
    const recipeIds = recipeRows.map((recipe) => recipe.id);
    const itemRows = await tx.select({ recipeId: recipeItems.recipeId, ingredientId: recipeItems.ingredientId, quantity: recipeItems.quantity }).from(recipeItems).where(inArray(recipeItems.recipeId, recipeIds)) as Array<{ recipeId: number; ingredientId: number; quantity: number }>;
    const recipesForSale = recipeRows.map((recipe) => ({ productId: recipe.productId, items: itemRows.filter((item) => item.recipeId === recipe.id).map(({ ingredientId, quantity }) => ({ ingredientId, quantity })) }));
    const ingredientIds = Array.from(new Set(itemRows.map((item) => item.ingredientId)));
    const ingredientRows = ingredientIds.length ? await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; name: string; currentStock: number; isActive: boolean }> : [];
    if (ingredientRows.some((ingredient) => !ingredient.isActive)) throw new Error("Bahan resep tidak aktif.");
    const deductions = planRecipeDeductions(lines, recipesForSale, ingredientRows);

    const productById = new Map(productRows.map((product) => [product.id, product]));
    const total = Number(lines.reduce((sum, line) => sum + ((productById.get(line.productId)?.sellingPrice ?? 0) * line.quantity), 0).toFixed(2));
    const saleResult = await tx.insert(sales).values({ receiptNumber, total });
    const saleId = Number(saleResult[0].insertId);
    await tx.insert(saleItems).values(lines.map((line) => {
      const product = productById.get(line.productId)!;
      return { saleId, productId: product.id, quantity: line.quantity, unitPrice: product.sellingPrice, lineTotal: Number((product.sellingPrice * line.quantity).toFixed(2)) };
    }));
    for (const deduction of deductions) await tx.update(ingredients).set({ currentStock: deduction.balanceAfter }).where(eq(ingredients.id, deduction.ingredientId));
    if (deductions.length) await tx.insert(stockMovements).values(deductions.map((deduction) => ({ ingredientId: deduction.ingredientId, saleId, type: "sale" as const, quantityDelta: deduction.quantityDelta, balanceAfter: deduction.balanceAfter, note: `Penjualan ${receiptNumber}` })));
    return { id: saleId, receiptNumber, total, lines };
}

export async function completeSale(input: z.infer<typeof saleCompletionInput>) {
  const db = await requireDb();
  return db.transaction((tx) => completeSaleInTransaction(tx, input));
}

export async function listSales() {
  const db = await requireDb();
  return db.select({ id: sales.id, receiptNumber: sales.receiptNumber, total: sales.total, completedAt: sales.completedAt, itemCount: count(saleItems.id) }).from(sales).leftJoin(saleItems, eq(saleItems.saleId, sales.id)).groupBy(sales.id, sales.receiptNumber, sales.total, sales.completedAt).orderBy(desc(sales.completedAt), desc(sales.id));
}
const defaults = { businessName: "Kopi Nusantara", storeLocation: "Cibitung Bekasi", currency: "IDR", timezone: "Asia/Jakarta" };
export async function getSettings() {
  const db = await requireDb(); const existing = await db.select().from(businessSettings).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(businessSettings).values(defaults);
  return (await db.select().from(businessSettings).where(eq(businessSettings.id, Number(result[0].insertId))).limit(1))[0];
}
export async function updateSettings(input: z.infer<typeof settingsInput>) {
  const db = await requireDb(); const existing = await db.select().from(businessSettings).limit(1);
  if (existing[0]) await db.update(businessSettings).set(input).where(eq(businessSettings.id, existing[0].id)); else await db.insert(businessSettings).values(input);
  return getSettings();
}
