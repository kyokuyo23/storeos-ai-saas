import { and, count, desc, eq, gte, inArray, isNotNull, lt, asc, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { nanoid } from "nanoid";
import { businessSettings, categories, exchangeItemIngredients, exchangeItems, exchanges, exchangeSettlements, governanceAuditQrExpiryPolicies, governanceAuditQrExpiryPolicyHistory, governanceAuditQrRevocations, governanceAuditVerificationReceiptIndex, ingredients, InsertUser, partialRefunds, products, recipeItems, recipes, saleItemIngredients, saleItems, sales, stockMovements, stockOpnameFollowUps, users, retentionSummaryExports, storedObjects } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { z } from "zod";
import type { categoryInput, exchangeInput, exchangeSettlementInput, ingredientInput, inventoryIntelligenceInput, inventoryMovementDrillDownInput, partialRefundInput, productFinancialInput, productInput, recipeInput, saleCompletionInput, saleReversalInput, settlementDateRangeInput, settingsInput, stockMovementInput, stockOpnameBatchInput, stockOpnameFollowUpInput, stockOpnameFollowUpNoteInput, stockOpnameHistoryInput } from "./foundationSchemas";
import { planStockOpname, resolveStockMovement } from "./inventory";
import { planRecipeDeductions } from "./sales";
import { summarizeFinancialSales, summarizeProductFinancialDetail, type FinancialSale } from "./financials";
import { summarizeInventoryIntelligence } from "./inventoryIntelligence";
import { applyStockOpnameFollowUpStatuses, summarizeOpenStockOpnameSessions, summarizeStockOpnameSessions } from "./opnameHistory";
import { GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES, isValidGovernanceAuditQrValidityMinutes, resolveGovernanceAuditQrExpiryPolicyChange } from "./governanceAuditQrExpiry";
import { normalizeGovernanceAuditQrRevocationReason } from "./governanceAuditQrRevocation";

let _db: ReturnType<typeof drizzle> | null = null;

/** PostgreSQL unique_violation (23505), directly or wrapped by drizzle's DrizzleQueryError.cause. */
export function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    // Supabase transaction pooler (Supavisor, port 6543): no prepared statements, and no query
    // pipelining (max_pipeline: 1). postgres.js pipelines extra queries onto busy connections by
    // default; through Supavisor that stalls concurrent requests until the function times out.
    try { _db = drizzle(postgres(process.env.DATABASE_URL, { prepare: false, max: 10, max_pipeline: 1, idle_timeout: 20, connect_timeout: 10 } as postgres.Options<Record<string, postgres.PostgresType>>)); }
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
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

// ---- Member (staff) accounts, managed by the owner-admin ----
const memberColumns = { id: users.id, name: users.name, username: users.username, accessLevel: users.accessLevel, isActive: users.isActive, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt };
export async function getMemberByUsername(username: string) {
  return (await (await requireDb()).select().from(users).where(eq(users.username, username)).limit(1))[0];
}
export async function listMemberAccounts() {
  const db = await requireDb();
  return db.select(memberColumns).from(users).where(and(eq(users.role, "user"), isNotNull(users.username))).orderBy(asc(users.username));
}
export async function createMemberAccount(input: { name: string; username: string; passwordHash: string; accessLevel: "member" | "sysadmin" }) {
  const db = await requireDb();
  const [row] = await db.insert(users).values({ openId: `member_${nanoid(24)}`, name: input.name, username: input.username, passwordHash: input.passwordHash, accessLevel: input.accessLevel, role: "user", loginMethod: "password", isActive: true, sessionVersion: 1 }).returning(memberColumns);
  return row;
}
/** Only member rows (role user with a username) can be changed here; returns false when no such member. */
export async function setMemberPassword(id: number, passwordHash: string) {
  const db = await requireDb();
  const rows = await db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, id), eq(users.role, "user"), isNotNull(users.username))).returning({ id: users.id });
  return rows.length > 0;
}
export async function setMemberActive(id: number, isActive: boolean) {
  const db = await requireDb();
  const rows = await db.update(users).set({ isActive, sessionVersion: sql`${users.sessionVersion} + 1` }).where(and(eq(users.id, id), eq(users.role, "user"), isNotNull(users.username))).returning({ id: users.id });
  return rows.length > 0;
}
export async function setMemberAccessLevel(id: number, accessLevel: "member" | "sysadmin") {
  const db = await requireDb();
  const rows = await db.update(users).set({ accessLevel }).where(and(eq(users.id, id), eq(users.role, "user"), isNotNull(users.username))).returning({ id: users.id });
  return rows.length > 0;
}
export async function recordMemberSignIn(id: number) {
  await (await requireDb()).update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function listCategories() { return (await requireDb()).select().from(categories).orderBy(categories.name); }
export async function createCategory(input: z.infer<typeof categoryInput>) {
  const db = await requireDb();
  const result = await db.insert(categories).values({ name: input.name, description: input.description || null }).returning({ insertId: categories.id });
  return (await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1))[0];
}
export async function listProducts() {
  const db = await requireDb();
  return db.select({ id: products.id, categoryId: products.categoryId, categoryName: categories.name, name: products.name, sku: products.sku, description: products.description, sellingPrice: products.sellingPrice, costPrice: products.costPrice, unit: products.unit, isActive: products.isActive, createdAt: products.createdAt, updatedAt: products.updatedAt }).from(products).innerJoin(categories, eq(products.categoryId, categories.id)).orderBy(desc(products.createdAt));
}
export async function createProduct(input: z.infer<typeof productInput>) {
  const db = await requireDb();
  return Number((await db.insert(products).values({ ...input, sku: input.sku || null, description: input.description || null }).returning({ insertId: products.id }))[0].insertId);
}
export async function updateProduct(id: number, input: z.infer<typeof productInput>) {
  await (await requireDb()).update(products).set({ ...input, sku: input.sku || null, description: input.description || null }).where(eq(products.id, id));
}
export async function listIngredients() { return (await requireDb()).select().from(ingredients).orderBy(ingredients.name); }
export async function createIngredient(input: z.infer<typeof ingredientInput>) { return Number((await (await requireDb()).insert(ingredients).values(input).returning({ insertId: ingredients.id }))[0].insertId); }
export async function updateIngredient(id: number, input: z.infer<typeof ingredientInput>) { await (await requireDb()).update(ingredients).set(input).where(eq(ingredients.id, id)); }
export async function listStockMovements() {
  const db = await requireDb();
  return db.select({ id: stockMovements.id, ingredientId: stockMovements.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, saleId: stockMovements.saleId, saleItemId: stockMovements.saleItemId, partialRefundId: stockMovements.partialRefundId, exchangeId: stockMovements.exchangeId, saleReceiptNumber: sales.receiptNumber, saleItemProductName: products.name, type: stockMovements.type, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, note: stockMovements.note, occurredAt: stockMovements.occurredAt }).from(stockMovements).innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id)).leftJoin(sales, eq(stockMovements.saleId, sales.id)).leftJoin(saleItems, eq(stockMovements.saleItemId, saleItems.id)).leftJoin(products, eq(saleItems.productId, products.id)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
}

export async function listStockOpnameSessions(input?: z.infer<typeof stockOpnameHistoryInput>) {
  const db = await requireDb();
  const rows = await db.select({ id: stockMovements.id, ingredientId: stockMovements.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, note: stockMovements.note, occurredAt: stockMovements.occurredAt }).from(stockMovements).innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id)).where(eq(stockMovements.type, "opname")).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
  const sessions = summarizeStockOpnameSessions(rows, input?.reference);
  if (!sessions.length) return sessions;
  const followUps = await db.select({ auditReference: stockOpnameFollowUps.auditReference, status: stockOpnameFollowUps.status, followUpNote: stockOpnameFollowUps.followUpNote }).from(stockOpnameFollowUps).where(inArray(stockOpnameFollowUps.auditReference, sessions.map((session) => session.reference)));
  return applyStockOpnameFollowUpStatuses(sessions, followUps);
}

export async function getOpenStockOpnameSummary() {
  return summarizeOpenStockOpnameSessions(await listStockOpnameSessions());
}

export async function updateStockOpnameFollowUp(input: z.infer<typeof stockOpnameFollowUpInput>) {
  const session = (await listStockOpnameSessions({ reference: input.reference })).find((item) => item.reference === input.reference);
  if (!session) throw new Error("Sesi opname dengan referensi audit tersebut tidak ditemukan.");
  if (session.differenceItems === 0) throw new Error("Status tindak lanjut hanya tersedia untuk sesi yang memiliki selisih stok.");
  const db = await requireDb();
  await db.insert(stockOpnameFollowUps).values({ auditReference: session.reference, status: input.status }).onConflictDoUpdate({ target: stockOpnameFollowUps.auditReference, set: { status: input.status } });
  return { reference: session.reference, status: input.status };
}

export async function updateStockOpnameFollowUpNote(input: z.infer<typeof stockOpnameFollowUpNoteInput>) {
  const session = (await listStockOpnameSessions({ reference: input.reference })).find((item) => item.reference === input.reference);
  if (!session) throw new Error("Sesi opname dengan referensi audit tersebut tidak ditemukan.");
  if (session.differenceItems === 0) throw new Error("Catatan tindak lanjut hanya tersedia untuk sesi yang memiliki selisih stok.");
  const db = await requireDb();
  const followUpNote = input.note?.trim() || null;
  await db.insert(stockOpnameFollowUps).values({ auditReference: session.reference, followUpNote }).onConflictDoUpdate({ target: stockOpnameFollowUps.auditReference, set: { followUpNote } });
  return { reference: session.reference, followUpNote };
}

export async function getIngredientMovementDrillDown(input: z.infer<typeof inventoryMovementDrillDownInput>) {
  const db = await requireDb();
  const ingredient = (await db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit }).from(ingredients).where(eq(ingredients.id, input.ingredientId)).limit(1))[0];
  if (!ingredient) throw new Error("Bahan tidak ditemukan.");
  const { start, end, startDate, endDate } = resolveSettlementDateRange(input);
  const movements = await db.select({ id: stockMovements.id, ingredientId: stockMovements.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, saleId: stockMovements.saleId, saleItemId: stockMovements.saleItemId, partialRefundId: stockMovements.partialRefundId, exchangeId: stockMovements.exchangeId, saleReceiptNumber: sales.receiptNumber, saleItemProductName: products.name, type: stockMovements.type, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, note: stockMovements.note, occurredAt: stockMovements.occurredAt }).from(stockMovements).innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id)).leftJoin(sales, eq(stockMovements.saleId, sales.id)).leftJoin(saleItems, eq(stockMovements.saleItemId, saleItems.id)).leftJoin(products, eq(saleItems.productId, products.id)).where(and(eq(stockMovements.ingredientId, input.ingredientId), gte(stockMovements.occurredAt, start), lt(stockMovements.occurredAt, end))).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
  return { ingredient, movements, dateStart: start, dateEnd: end, startDate, endDate };
}
export async function recordStockMovement(input: z.infer<typeof stockMovementInput>) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const ingredient = (await tx.select().from(ingredients).where(eq(ingredients.id, input.ingredientId)).limit(1))[0];
    if (!ingredient) throw new Error("Bahan tidak ditemukan.");
    const movement = resolveStockMovement(ingredient.currentStock, input);
    await tx.update(ingredients).set({ currentStock: movement.balanceAfter }).where(eq(ingredients.id, ingredient.id));
    const result = await tx.insert(stockMovements).values({ ingredientId: ingredient.id, type: input.type, quantityDelta: movement.quantityDelta, balanceAfter: movement.balanceAfter, note: input.note || null }).returning({ insertId: stockMovements.id });
    return { id: Number(result[0].insertId), ...movement };
  });
}

export async function recordStockOpnameBatch(input: z.infer<typeof stockOpnameBatchInput>) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const ingredientIds = input.counts.map((count) => count.ingredientId);
    const ingredientRows = await tx.select({ id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock }).from(ingredients).where(inArray(ingredients.id, ingredientIds));
    const planned = planStockOpname(ingredientRows, input.counts);
    const reference = `OPN-${Date.now()}-${nanoid(5).toUpperCase()}`;
    const note = ["Stock opname fisik", reference, input.note?.trim()].filter(Boolean).join(" · ");
    for (const item of planned) await tx.update(ingredients).set({ currentStock: item.balanceAfter }).where(eq(ingredients.id, item.ingredientId));
    await tx.insert(stockMovements).values(planned.map((item) => ({ ingredientId: item.ingredientId, type: "opname" as const, quantityDelta: item.quantityDelta, balanceAfter: item.balanceAfter, note })));
    return { reference, totalItems: planned.length, differenceItems: planned.filter((item) => item.quantityDelta !== 0).length, totalAbsoluteDifference: Number(planned.reduce((total, item) => total + Math.abs(item.quantityDelta), 0).toFixed(3)), items: planned };
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
    const activeRecipeId = recipeId ?? Number((await tx.insert(recipes).values({ productId: input.productId, name: input.name }).returning({ insertId: recipes.id }))[0].insertId);
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
  const ingredientRows = ingredientIds.length ? await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; name: string; currentStock: number; costPerUnit: number; isActive: boolean }> : [];
  if (ingredientRows.some((ingredient) => !ingredient.isActive)) throw new Error("Bahan resep tidak aktif.");
  const deductions = planRecipeDeductions(lines, recipesForSale, ingredientRows);
  const productById = new Map(productRows.map((product) => [product.id, product]));
  const ingredientById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  const total = Number(lines.reduce((sum, line) => sum + ((productById.get(line.productId)?.sellingPrice ?? 0) * line.quantity), 0).toFixed(2));
  const saleResult = await tx.insert(sales).values({ receiptNumber, total }).returning({ insertId: sales.id });
  const saleId = Number(saleResult[0].insertId);
  const saleLineRecords: Array<{ saleItemId: number; productId: number; quantity: number }> = [];
  for (const line of lines) {
    const product = productById.get(line.productId)!;
    const saleItemResult = await tx.insert(saleItems).values({ saleId, productId: product.id, quantity: line.quantity, unitPrice: product.sellingPrice, lineTotal: Number((product.sellingPrice * line.quantity).toFixed(2)) }).returning({ insertId: saleItems.id });
    const saleItemId = Number(saleItemResult[0].insertId);
    saleLineRecords.push({ saleItemId, productId: product.id, quantity: line.quantity });
    const recipe = recipesForSale.find((candidate) => candidate.productId === product.id)!;
    await tx.insert(saleItemIngredients).values(recipe.items.map((item) => ({ saleItemId, ingredientId: item.ingredientId, unitQuantity: item.quantity, unitCost: ingredientById.get(item.ingredientId)!.costPerUnit })));
  }
  for (const deduction of deductions) await tx.update(ingredients).set({ currentStock: deduction.balanceAfter }).where(eq(ingredients.id, deduction.ingredientId));
  if (deductions.length) await tx.insert(stockMovements).values(deductions.map((deduction) => ({ ingredientId: deduction.ingredientId, saleId, type: "sale" as const, quantityDelta: deduction.quantityDelta, balanceAfter: deduction.balanceAfter, note: `Penjualan ${receiptNumber}` })));
  return { id: saleId, receiptNumber, total, lines: saleLineRecords };
}
export async function completeSale(input: z.infer<typeof saleCompletionInput>) { return (await requireDb()).transaction((tx) => completeSaleInTransaction(tx, input)); }

export async function reverseSaleInTransaction(tx: any, input: z.infer<typeof saleReversalInput>) {
  const sale = (await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1))[0] as { id: number; receiptNumber: string; status: "completed" | "partially_refunded" | "voided" | "refunded" } | undefined;
  if (!sale) throw new Error("Penjualan tidak ditemukan.");
  if (sale.status === "voided" || sale.status === "refunded") throw new Error("Transaksi sudah dibatalkan atau direfund.");
  const originalMovements = await tx.select().from(stockMovements).where(eq(stockMovements.saleId, sale.id)) as Array<{ ingredientId: number; type: string; quantityDelta: number }>;
  const deductions = originalMovements.filter((movement) => (movement.type === "sale" || movement.type === "exchange_sale") && movement.quantityDelta < 0);
  if (!deductions.length) throw new Error("Catatan pengurangan stok tidak ditemukan.");
  const restoredByPartialRefund = new Map<number, number>();
  originalMovements.filter((movement) => (movement.type === "partial_refund" || movement.type === "exchange_return") && movement.quantityDelta > 0).forEach((movement) => restoredByPartialRefund.set(movement.ingredientId, (restoredByPartialRefund.get(movement.ingredientId) ?? 0) + movement.quantityDelta));
  const remainingByIngredient = new Map<number, number>();
  deductions.forEach((movement) => remainingByIngredient.set(movement.ingredientId, (remainingByIngredient.get(movement.ingredientId) ?? 0) + Math.abs(movement.quantityDelta)));
  remainingByIngredient.forEach((quantity, ingredientId) => remainingByIngredient.set(ingredientId, Number(Math.max(0, quantity - (restoredByPartialRefund.get(ingredientId) ?? 0)).toFixed(3))));
  const ingredientIds = Array.from(remainingByIngredient.keys());
  const ingredientRows = await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; currentStock: number }>;
  if (ingredientRows.length !== ingredientIds.length) throw new Error("Bahan resep tidak ditemukan.");
  const ingredientById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  const restorations = ingredientIds.flatMap((ingredientId) => {
    const quantityDelta = remainingByIngredient.get(ingredientId) ?? 0;
    if (!quantityDelta) return [];
    const ingredient = ingredientById.get(ingredientId)!;
    return [{ ingredientId, quantityDelta, balanceAfter: Number((ingredient.currentStock + quantityDelta).toFixed(3)) }];
  });
  for (const restoration of restorations) await tx.update(ingredients).set({ currentStock: restoration.balanceAfter }).where(eq(ingredients.id, restoration.ingredientId));
  const status = input.type === "void" ? "voided" as const : "refunded" as const;
  const actionLabel = input.type === "void" ? "Void" : "Refund";
  if (restorations.length) await tx.insert(stockMovements).values(restorations.map((restoration) => ({ ingredientId: restoration.ingredientId, saleId: sale.id, type: input.type, quantityDelta: restoration.quantityDelta, balanceAfter: restoration.balanceAfter, note: `${actionLabel} ${sale.receiptNumber}${input.reason ? ` — ${input.reason}` : ""}` })));
  await tx.update(sales).set({ status, reversedAt: new Date(), reversalReason: input.reason || null }).where(eq(sales.id, sale.id));
  return { id: sale.id, receiptNumber: sale.receiptNumber, status, restorations };
}
export async function reverseSaleWithClient(client: { transaction: (callback: (tx: any) => Promise<any>) => Promise<any> }, input: z.infer<typeof saleReversalInput>) { return client.transaction((tx) => reverseSaleInTransaction(tx, input)); }
export async function reverseSale(input: z.infer<typeof saleReversalInput>) { return reverseSaleWithClient(await requireDb() as any, input); }

export async function partialRefundInTransaction(tx: any, input: z.infer<typeof partialRefundInput>) {
  const sale = (await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1))[0] as { id: number; receiptNumber: string; status: "completed" | "partially_refunded" | "voided" | "refunded" } | undefined;
  if (!sale) throw new Error("Penjualan tidak ditemukan.");
  if (sale.status === "voided" || sale.status === "refunded") throw new Error("Transaksi sudah dibatalkan atau direfund.");
  const saleItem = (await tx.select().from(saleItems).where(and(eq(saleItems.id, input.saleItemId), eq(saleItems.saleId, sale.id))).limit(1))[0] as { id: number; productId: number; quantity: number } | undefined;
  if (!saleItem) throw new Error("Baris penjualan tidak ditemukan.");
  const snapshots = await tx.select().from(saleItemIngredients).where(eq(saleItemIngredients.saleItemId, saleItem.id)) as Array<{ ingredientId: number; unitQuantity: number }>;
  if (!snapshots.length) throw new Error("Catatan resep penjualan tidak ditemukan.");
  const existingRefunds = await tx.select().from(partialRefunds).where(eq(partialRefunds.saleItemId, saleItem.id)) as Array<{ quantity: number }>;
  const refundedQuantity = existingRefunds.reduce((sum, refund) => sum + refund.quantity, 0);
  const remainingBeforeExchanges = saleItem.quantity - refundedQuantity;
  if (input.quantity > remainingBeforeExchanges) throw new Error(`Jumlah refund melebihi sisa item (${remainingBeforeExchanges}).`);
  const restoreByIngredient = new Map<number, number>();
  snapshots.forEach((snapshot) => restoreByIngredient.set(snapshot.ingredientId, Number(((restoreByIngredient.get(snapshot.ingredientId) ?? 0) + snapshot.unitQuantity * input.quantity).toFixed(3))));
  const ingredientIds = Array.from(restoreByIngredient.keys());
  const ingredientRows = await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; currentStock: number }>;
  if (ingredientRows.length !== ingredientIds.length) throw new Error("Bahan resep tidak ditemukan.");
  const existingExchanges = await tx.select({ returnedQuantity: exchanges.returnedQuantity }).from(exchanges).where(eq(exchanges.saleItemId, saleItem.id)) as Array<{ returnedQuantity: number }>;
  const exchangedQuantity = existingExchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
  const remainingQuantity = saleItem.quantity - refundedQuantity - exchangedQuantity;
  if (input.quantity > remainingQuantity) throw new Error(`Jumlah refund melebihi sisa item (${remainingQuantity}).`);
  const ingredientById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  const refundResult = await tx.insert(partialRefunds).values({ saleId: sale.id, saleItemId: saleItem.id, quantity: input.quantity, reason: input.reason || null }).returning({ insertId: partialRefunds.id });
  const partialRefundId = Number(refundResult[0].insertId);
  const restorations = ingredientIds.map((ingredientId) => {
    const quantityDelta = restoreByIngredient.get(ingredientId)!;
    const ingredient = ingredientById.get(ingredientId)!;
    return { ingredientId, quantityDelta, balanceAfter: Number((ingredient.currentStock + quantityDelta).toFixed(3)) };
  });
  for (const restoration of restorations) await tx.update(ingredients).set({ currentStock: restoration.balanceAfter }).where(eq(ingredients.id, restoration.ingredientId));
  await tx.insert(stockMovements).values(restorations.map((restoration) => ({ ingredientId: restoration.ingredientId, saleId: sale.id, saleItemId: saleItem.id, partialRefundId, type: "partial_refund" as const, quantityDelta: restoration.quantityDelta, balanceAfter: restoration.balanceAfter, note: `Refund sebagian ${sale.receiptNumber} · item #${saleItem.id} ×${input.quantity}${input.reason ? ` — ${input.reason}` : ""}` })));
  if (sale.status === "completed") await tx.update(sales).set({ status: "partially_refunded" }).where(eq(sales.id, sale.id));
  return { id: partialRefundId, saleId: sale.id, saleItemId: saleItem.id, quantity: input.quantity, remainingQuantity: remainingQuantity - input.quantity, restorations };
}
export async function partialRefundWithClient(client: { transaction: (callback: (tx: any) => Promise<any>) => Promise<any> }, input: z.infer<typeof partialRefundInput>) { return client.transaction((tx) => partialRefundInTransaction(tx, input)); }
export async function partialRefundSaleItem(input: z.infer<typeof partialRefundInput>) { return partialRefundWithClient(await requireDb() as any, input); }

export async function exchangeInTransaction(tx: any, input: z.infer<typeof exchangeInput>) {
  const sale = (await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1))[0] as { id: number; receiptNumber: string; status: "completed" | "partially_refunded" | "voided" | "refunded" } | undefined;
  if (!sale) throw new Error("Penjualan tidak ditemukan.");
  if (sale.status === "voided" || sale.status === "refunded") throw new Error("Transaksi sudah dibatalkan atau direfund.");
  const saleItem = (await tx.select().from(saleItems).where(and(eq(saleItems.id, input.saleItemId), eq(saleItems.saleId, sale.id))).limit(1))[0] as { id: number; productId: number; quantity: number; unitPrice: number } | undefined;
  if (!saleItem) throw new Error("Baris penjualan tidak ditemukan.");
  const returnedRecipe = await tx.select().from(saleItemIngredients).where(eq(saleItemIngredients.saleItemId, saleItem.id)) as Array<{ ingredientId: number; unitQuantity: number; unitCost: number }>;
  if (!returnedRecipe.length) throw new Error("Catatan resep penjualan tidak ditemukan.");
  const existingRefunds = await tx.select({ quantity: partialRefunds.quantity }).from(partialRefunds).where(eq(partialRefunds.saleItemId, saleItem.id)) as Array<{ quantity: number }>;
  const existingExchanges = await tx.select({ returnedQuantity: exchanges.returnedQuantity }).from(exchanges).where(eq(exchanges.saleItemId, saleItem.id)) as Array<{ returnedQuantity: number }>;
  const remainingQuantity = saleItem.quantity - existingRefunds.reduce((sum, refund) => sum + refund.quantity, 0) - existingExchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
  if (input.returnedQuantity > remainingQuantity) throw new Error(`Jumlah penukaran melebihi sisa item (${remainingQuantity}).`);

  const replacementByProduct = new Map<number, number>();
  input.replacementItems.forEach((item: { productId: number; quantity: number }) => replacementByProduct.set(item.productId, (replacementByProduct.get(item.productId) ?? 0) + item.quantity));
  const replacementLines = Array.from(replacementByProduct, ([productId, quantity]) => ({ productId, quantity }));
  const productIds = replacementLines.map((line) => line.productId);
  const replacementProducts = await tx.select().from(products).where(inArray(products.id, productIds)) as Array<{ id: number; sellingPrice: number; isActive: boolean }>;
  if (replacementProducts.length !== productIds.length || replacementProducts.some((product) => !product.isActive)) throw new Error("Produk tidak tersedia.");
  const replacementRecipes = await tx.select().from(recipes).where(inArray(recipes.productId, productIds)) as Array<{ id: number; productId: number }>;
  if (replacementRecipes.length !== productIds.length) throw new Error("Produk pengganti belum memiliki resep.");
  const recipeIds = replacementRecipes.map((recipe) => recipe.id);
  const replacementRecipeItems = await tx.select({ recipeId: recipeItems.recipeId, ingredientId: recipeItems.ingredientId, quantity: recipeItems.quantity }).from(recipeItems).where(inArray(recipeItems.recipeId, recipeIds)) as Array<{ recipeId: number; ingredientId: number; quantity: number }>;
  if (replacementRecipes.some((recipe) => !replacementRecipeItems.some((item) => item.recipeId === recipe.id))) throw new Error("Produk pengganti belum memiliki resep.");

  const restorationByIngredient = new Map<number, number>();
  returnedRecipe.forEach((item) => restorationByIngredient.set(item.ingredientId, Number(((restorationByIngredient.get(item.ingredientId) ?? 0) + item.unitQuantity * input.returnedQuantity).toFixed(3))));
  const deductionByIngredient = new Map<number, number>();
  replacementLines.forEach((line) => {
    const recipe = replacementRecipes.find((candidate) => candidate.productId === line.productId)!;
    replacementRecipeItems.filter((item) => item.recipeId === recipe.id).forEach((item) => deductionByIngredient.set(item.ingredientId, Number(((deductionByIngredient.get(item.ingredientId) ?? 0) + item.quantity * line.quantity).toFixed(3))));
  });
  const ingredientIds = Array.from(new Set([...Array.from(restorationByIngredient.keys()), ...Array.from(deductionByIngredient.keys())]));
  const ingredientRows = await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; name: string; currentStock: number; costPerUnit: number; isActive: boolean }>;
  if (ingredientRows.length !== ingredientIds.length) throw new Error("Bahan resep tidak ditemukan.");
  if (ingredientRows.some((ingredient) => !ingredient.isActive)) throw new Error("Bahan resep tidak aktif.");
  const ingredientById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  ingredientIds.forEach((ingredientId) => {
    const ingredient = ingredientById.get(ingredientId)!;
    const availableAfterReturn = Number((ingredient.currentStock + (restorationByIngredient.get(ingredientId) ?? 0)).toFixed(3));
    const deduction = deductionByIngredient.get(ingredientId) ?? 0;
    if (availableAfterReturn < deduction) throw new Error(`Stok bahan tidak mencukupi: ${ingredient.name} membutuhkan ${deduction}, tersedia ${availableAfterReturn}.`);
  });

  const productById = new Map(replacementProducts.map((product) => [product.id, product]));
  const returnedTotal = Number((saleItem.unitPrice * input.returnedQuantity).toFixed(2));
  const replacementTotal = Number(replacementLines.reduce((sum, line) => sum + productById.get(line.productId)!.sellingPrice * line.quantity, 0).toFixed(2));
  const paymentAdjustment = Number((replacementTotal - returnedTotal).toFixed(2));
  const exchangeResult = await tx.insert(exchanges).values({ saleId: sale.id, saleItemId: saleItem.id, returnedQuantity: input.returnedQuantity, returnedTotal, replacementTotal, paymentAdjustment, reason: input.reason || null }).returning({ insertId: exchanges.id });
  const exchangeId = Number(exchangeResult[0].insertId);
  const issuedItems: Array<{ exchangeItemId: number; productId: number; quantity: number }> = [];
  for (const line of replacementLines) {
    const product = productById.get(line.productId)!;
    const exchangeItemResult = await tx.insert(exchangeItems).values({ exchangeId, productId: product.id, quantity: line.quantity, unitPrice: product.sellingPrice, lineTotal: Number((product.sellingPrice * line.quantity).toFixed(2)) }).returning({ insertId: exchangeItems.id });
    const exchangeItemId = Number(exchangeItemResult[0].insertId);
    issuedItems.push({ exchangeItemId, productId: product.id, quantity: line.quantity });
    const recipe = replacementRecipes.find((candidate) => candidate.productId === product.id)!;
    await tx.insert(exchangeItemIngredients).values(replacementRecipeItems.filter((item) => item.recipeId === recipe.id).map((item) => ({ exchangeItemId, ingredientId: item.ingredientId, unitQuantity: item.quantity, unitCost: ingredientById.get(item.ingredientId)!.costPerUnit })));
  }
  const restorationMovements = ingredientIds.flatMap((ingredientId) => {
    const quantityDelta = restorationByIngredient.get(ingredientId) ?? 0;
    if (!quantityDelta) return [];
    const ingredient = ingredientById.get(ingredientId)!;
    return [{ ingredientId, quantityDelta, balanceAfter: Number((ingredient.currentStock + quantityDelta).toFixed(3)) }];
  });
  const deductionMovements = ingredientIds.flatMap((ingredientId) => {
    const quantity = deductionByIngredient.get(ingredientId) ?? 0;
    if (!quantity) return [];
    const ingredient = ingredientById.get(ingredientId)!;
    return [{ ingredientId, quantityDelta: -quantity, balanceAfter: Number((ingredient.currentStock + (restorationByIngredient.get(ingredientId) ?? 0) - quantity).toFixed(3)) }];
  });
  for (const ingredientId of ingredientIds) {
    const ingredient = ingredientById.get(ingredientId)!;
    const balanceAfter = Number((ingredient.currentStock + (restorationByIngredient.get(ingredientId) ?? 0) - (deductionByIngredient.get(ingredientId) ?? 0)).toFixed(3));
    await tx.update(ingredients).set({ currentStock: balanceAfter }).where(eq(ingredients.id, ingredientId));
  }
  if (restorationMovements.length) await tx.insert(stockMovements).values(restorationMovements.map((movement) => ({ ...movement, saleId: sale.id, saleItemId: saleItem.id, exchangeId, type: "exchange_return" as const, note: `Penukaran ${sale.receiptNumber} · pengembalian item #${saleItem.id} ×${input.returnedQuantity}${input.reason ? ` — ${input.reason}` : ""}` })));
  if (deductionMovements.length) await tx.insert(stockMovements).values(deductionMovements.map((movement) => ({ ...movement, saleId: sale.id, saleItemId: saleItem.id, exchangeId, type: "exchange_sale" as const, note: `Penukaran ${sale.receiptNumber} · produk pengganti${input.reason ? ` — ${input.reason}` : ""}` })));
  if (sale.status === "completed") await tx.update(sales).set({ status: "partially_refunded" }).where(eq(sales.id, sale.id));
  return { id: exchangeId, saleId: sale.id, saleItemId: saleItem.id, returnedQuantity: input.returnedQuantity, returnedTotal, replacementTotal, priceDifference: paymentAdjustment, remainingQuantity: remainingQuantity - input.returnedQuantity, items: issuedItems, restorations: restorationMovements, deductions: deductionMovements };
}
export async function exchangeWithClient(client: { transaction: (callback: (tx: any) => Promise<any>) => Promise<any> }, input: z.infer<typeof exchangeInput>) { return client.transaction((tx) => exchangeInTransaction(tx, input)); }
export async function exchangeSaleItem(input: z.infer<typeof exchangeInput>) { return exchangeWithClient(await requireDb() as any, input); }

export async function settleExchangeInTransaction(tx: any, input: z.infer<typeof exchangeSettlementInput>) {
  const exchange = (await tx.select().from(exchanges).where(eq(exchanges.id, input.exchangeId)).limit(1))[0] as { id: number; saleId: number; paymentAdjustment: number } | undefined;
  if (!exchange) throw new Error("Penukaran tidak ditemukan.");
  if (exchange.paymentAdjustment <= 0) throw new Error("Penukaran ini tidak memerlukan tambahan pembayaran.");
  const sale = (await tx.select().from(sales).where(eq(sales.id, exchange.saleId)).limit(1))[0] as { id: number; status: "completed" | "partially_refunded" | "voided" | "refunded" } | undefined;
  if (!sale) throw new Error("Penjualan tidak ditemukan.");
  if (sale.status === "voided" || sale.status === "refunded") throw new Error("Transaksi sudah dibatalkan atau direfund.");
  const existing = await tx.select().from(exchangeSettlements).where(eq(exchangeSettlements.exchangeId, exchange.id)) as Array<{ id: number }>;
  if (existing.length) throw new Error("Pembayaran tambahan penukaran sudah dicatat.");
  const result = await tx.insert(exchangeSettlements).values({ exchangeId: exchange.id, amount: exchange.paymentAdjustment, paymentMethod: input.paymentMethod }).returning({ insertId: exchangeSettlements.id });
  return { id: Number(result[0].insertId), exchangeId: exchange.id, amount: exchange.paymentAdjustment, paymentMethod: input.paymentMethod };
}
export async function settleExchangeWithClient(client: { transaction: (callback: (tx: any) => Promise<any>) => Promise<any> }, input: z.infer<typeof exchangeSettlementInput>) { return client.transaction((tx) => settleExchangeInTransaction(tx, input)); }
export async function settleExchange(input: z.infer<typeof exchangeSettlementInput>) { return settleExchangeWithClient(await requireDb() as any, input); }

export function summarizeDailySettlements(rows: Array<{ amount: number; paymentMethod: "cash" | "card" }>) {
  const cashTotal = rows.filter((row) => row.paymentMethod === "cash").reduce((sum, row) => sum + row.amount, 0);
  const cardTotal = rows.filter((row) => row.paymentMethod === "card").reduce((sum, row) => sum + row.amount, 0);
  return { cashTotal, cardTotal, total: cashTotal + cardTotal, count: rows.length };
}

function jakartaDayRange(now = new Date()) {
  const jakartaDate = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${jakartaDate}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000), startDate: jakartaDate, endDate: jakartaDate };
}

export function resolveSettlementDateRange(input?: z.infer<typeof settlementDateRangeInput>, now = new Date()) {
  if (!input?.startDate || !input.endDate) return jakartaDayRange(now);
  const start = new Date(`${input.startDate}T00:00:00+07:00`);
  const endStart = new Date(`${input.endDate}T00:00:00+07:00`);
  return { start, end: new Date(endStart.getTime() + 24 * 60 * 60 * 1000), startDate: input.startDate, endDate: input.endDate };
}

export async function getInventoryIntelligence(input?: z.infer<typeof inventoryIntelligenceInput>) {
  const db = await requireDb();
  const { start, end, startDate, endDate } = resolveSettlementDateRange(input);
  const [ingredientRows, movementRows, settings] = await Promise.all([
    db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit, costPerUnit: ingredients.costPerUnit }).from(ingredients).orderBy(ingredients.name),
    db.select({ ingredientId: stockMovements.ingredientId, type: stockMovements.type, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, occurredAt: stockMovements.occurredAt }).from(stockMovements).where(lt(stockMovements.occurredAt, end)).orderBy(stockMovements.occurredAt, stockMovements.id),
    getSettings(),
  ]);
  return { ...summarizeInventoryIntelligence(ingredientRows, movementRows, { start, end }, { absoluteQuantity: settings.inventoryVarianceAbsoluteTolerance, percentage: settings.inventoryVariancePercentageTolerance }), dateStart: start, dateEnd: end, startDate, endDate };
}

export async function getDailySettlementSummary(input?: z.infer<typeof settlementDateRangeInput>) {
  const { start, end, startDate, endDate } = resolveSettlementDateRange(input);
  const rows = await (await requireDb()).select({ amount: exchangeSettlements.amount, paymentMethod: exchangeSettlements.paymentMethod }).from(exchangeSettlements).where(and(gte(exchangeSettlements.createdAt, start), lt(exchangeSettlements.createdAt, end)));
  return { ...summarizeDailySettlements(rows), dateStart: start, dateEnd: end, startDate, endDate };
}

export async function getFinancialDashboard(input?: z.infer<typeof settlementDateRangeInput>) {
  const { start, end, startDate, endDate } = resolveSettlementDateRange(input);
  const reportSales = (await listSales()).filter((sale) => sale.completedAt >= start && sale.completedAt < end) as FinancialSale[];
  return { ...summarizeFinancialSales(reportSales), dateStart: start, dateEnd: end, startDate, endDate };
}

export async function getProductFinancialDetail(input: z.infer<typeof productFinancialInput>) {
  const db = await requireDb();
  const product = (await db.select({ id: products.id, name: products.name, unit: products.unit, sellingPrice: products.sellingPrice, isActive: products.isActive }).from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!product) throw new Error("Produk tidak ditemukan.");
  const { start, end, startDate, endDate } = resolveSettlementDateRange(input);
  const reportSales = (await listSales()).filter((sale) => sale.completedAt >= start && sale.completedAt < end) as Array<FinancialSale & { receiptNumber?: string }>;
  const detail = summarizeProductFinancialDetail(product.id, reportSales);
  const ingredientIds = Array.from(new Set(detail.history.flatMap((entry) => entry.ingredientSnapshots.map((snapshot) => snapshot.ingredientId).filter((id): id is number => Boolean(id)))));
  const ingredientRows = ingredientIds.length ? await db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit }).from(ingredients).where(inArray(ingredients.id, ingredientIds)) : [];
  const ingredientById = new Map(ingredientRows.map((ingredient) => [ingredient.id, ingredient]));
  return {
    product,
    ...detail,
    productName: detail.productName || product.name,
    dateStart: start,
    dateEnd: end,
    startDate,
    endDate,
    history: detail.history.map((entry) => ({ ...entry, ingredients: entry.ingredientSnapshots.map((snapshot) => ({ ...snapshot, ingredient: snapshot.ingredientId ? ingredientById.get(snapshot.ingredientId) ?? null : null })) })),
  };
}

export async function listSales() {
  const db = await requireDb();
  const saleRows = await db.select({ id: sales.id, receiptNumber: sales.receiptNumber, status: sales.status, total: sales.total, completedAt: sales.completedAt, reversedAt: sales.reversedAt, reversalReason: sales.reversalReason, itemCount: count(saleItems.id) }).from(sales).leftJoin(saleItems, eq(saleItems.saleId, sales.id)).groupBy(sales.id, sales.receiptNumber, sales.status, sales.total, sales.completedAt, sales.reversedAt, sales.reversalReason).orderBy(desc(sales.completedAt), desc(sales.id));
  const saleIds = saleRows.map((sale) => sale.id);
  if (!saleIds.length) return [];
  const itemRows = await db.select({ id: saleItems.id, saleId: saleItems.saleId, productId: saleItems.productId, productName: products.name, quantity: saleItems.quantity, unitPrice: saleItems.unitPrice, lineTotal: saleItems.lineTotal }).from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(inArray(saleItems.saleId, saleIds)).orderBy(saleItems.id);
  const refundRows = await db.select({ id: partialRefunds.id, saleId: partialRefunds.saleId, saleItemId: partialRefunds.saleItemId, quantity: partialRefunds.quantity, reason: partialRefunds.reason, createdAt: partialRefunds.createdAt }).from(partialRefunds).where(inArray(partialRefunds.saleId, saleIds)).orderBy(partialRefunds.createdAt, partialRefunds.id);
  const exchangeRows = await db.select({ id: exchanges.id, saleId: exchanges.saleId, saleItemId: exchanges.saleItemId, returnedQuantity: exchanges.returnedQuantity, returnedTotal: exchanges.returnedTotal, replacementTotal: exchanges.replacementTotal, paymentAdjustment: exchanges.paymentAdjustment, reason: exchanges.reason, createdAt: exchanges.createdAt }).from(exchanges).where(inArray(exchanges.saleId, saleIds)).orderBy(exchanges.createdAt, exchanges.id);
  const exchangeIds = exchangeRows.map((exchange) => exchange.id);
  const itemIngredientRows = itemRows.length ? await db.select({ saleItemId: saleItemIngredients.saleItemId, ingredientId: saleItemIngredients.ingredientId, unitQuantity: saleItemIngredients.unitQuantity, unitCost: saleItemIngredients.unitCost }).from(saleItemIngredients).where(inArray(saleItemIngredients.saleItemId, itemRows.map((item) => item.id))) : [];
  const exchangeItemRows = exchangeIds.length ? await db.select({ id: exchangeItems.id, exchangeId: exchangeItems.exchangeId, productId: exchangeItems.productId, productName: products.name, quantity: exchangeItems.quantity, unitPrice: exchangeItems.unitPrice, lineTotal: exchangeItems.lineTotal }).from(exchangeItems).innerJoin(products, eq(exchangeItems.productId, products.id)).where(inArray(exchangeItems.exchangeId, exchangeIds)).orderBy(exchangeItems.id) : [];
  const exchangeIngredientRows = exchangeItemRows.length ? await db.select({ exchangeItemId: exchangeItemIngredients.exchangeItemId, ingredientId: exchangeItemIngredients.ingredientId, unitQuantity: exchangeItemIngredients.unitQuantity, unitCost: exchangeItemIngredients.unitCost }).from(exchangeItemIngredients).where(inArray(exchangeItemIngredients.exchangeItemId, exchangeItemRows.map((item) => item.id))) : [];
  const settlementRows = exchangeIds.length ? await db.select({ id: exchangeSettlements.id, exchangeId: exchangeSettlements.exchangeId, amount: exchangeSettlements.amount, paymentMethod: exchangeSettlements.paymentMethod, createdAt: exchangeSettlements.createdAt }).from(exchangeSettlements).where(inArray(exchangeSettlements.exchangeId, exchangeIds)).orderBy(exchangeSettlements.createdAt, exchangeSettlements.id) : [];
  const records = saleRows.map((sale) => ({ ...sale, lines: itemRows.filter((item) => item.saleId === sale.id).map((item) => {
    const refunds = refundRows.filter((refund) => refund.saleItemId === item.id);
    const itemExchanges = exchangeRows.filter((exchange) => exchange.saleItemId === item.id).map((exchange) => ({ ...exchange, items: exchangeItemRows.filter((exchangeItem) => exchangeItem.exchangeId === exchange.id).map((exchangeItem) => ({ ...exchangeItem, ingredientSnapshots: exchangeIngredientRows.filter((ingredient) => ingredient.exchangeItemId === exchangeItem.id) })), settlement: settlementRows.find((settlement) => settlement.exchangeId === exchange.id) || null }));
    const refundedQuantity = refunds.reduce((sum, refund) => sum + refund.quantity, 0);
    const exchangedQuantity = itemExchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
    return { ...item, ingredientSnapshots: itemIngredientRows.filter((ingredient) => ingredient.saleItemId === item.id), refundedQuantity, exchangedQuantity, refundableQuantity: item.quantity - refundedQuantity - exchangedQuantity, partialRefunds: refunds, exchanges: itemExchanges };
  }) }));
  const financialBySaleId = new Map(summarizeFinancialSales(records as FinancialSale[]).saleSummaries.map((summary) => [summary.saleId, summary]));
  return records.map((sale) => ({ ...sale, financial: financialBySaleId.get(sale.id) ?? { saleId: sale.id, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, unitsSold: 0 } }));
}

const defaults = { businessName: "Kopi Nusantara", storeLocation: "Cibitung Bekasi", currency: "IDR", timezone: "Asia/Jakarta", opnameWarningAgeDays: 3, opnameCriticalAgeDays: 7, inventoryVarianceAbsoluteTolerance: 0.001, inventoryVariancePercentageTolerance: 0 };
/**
 * Business settings are a singleton (row id 1). Concurrent first loads used to race and insert two
 * default rows, and unordered `limit 1` reads could then return different rows to get/update.
 */
const SETTINGS_ID = 1;
async function readSettings(db: Awaited<ReturnType<typeof requireDb>>) {
  return (await db.select().from(businessSettings).orderBy(asc(businessSettings.id)).limit(1))[0];
}
export async function getSettings() {
  const db = await requireDb();
  const existing = await readSettings(db);
  if (existing) return existing;
  await db.insert(businessSettings).values({ id: SETTINGS_ID, ...defaults }).onConflictDoNothing({ target: businessSettings.id });
  return (await readSettings(db))!;
}
export async function updateSettings(input: z.infer<typeof settingsInput>) {
  const db = await requireDb();
  const existing = await readSettings(db);
  if (existing) await db.update(businessSettings).set(input).where(eq(businessSettings.id, existing.id));
  else await db.insert(businessSettings).values({ id: SETTINGS_ID, ...input }).onConflictDoUpdate({ target: businessSettings.id, set: input });
  return getSettings();
}

export async function getGovernanceAuditQrExpiryPolicy(ownerOpenId: string) {
  const db = await requireDb();
  const existing = await db.select().from(governanceAuditQrExpiryPolicies).where(eq(governanceAuditQrExpiryPolicies.ownerOpenId, ownerOpenId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(governanceAuditQrExpiryPolicies).values({ ownerOpenId, validityMinutes: GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES });
  return (await db.select().from(governanceAuditQrExpiryPolicies).where(eq(governanceAuditQrExpiryPolicies.ownerOpenId, ownerOpenId)).limit(1))[0];
}

export async function updateGovernanceAuditQrExpiryPolicy(ownerOpenId: string, validityMinutes: number, actorOpenId = ownerOpenId) {
  if (!isValidGovernanceAuditQrValidityMinutes(validityMinutes)) throw new Error("Masa berlaku QR harus berada dalam batas yang diizinkan.");
  const db = await requireDb();
  const existing = await db.select().from(governanceAuditQrExpiryPolicies).where(eq(governanceAuditQrExpiryPolicies.ownerOpenId, ownerOpenId)).limit(1);
  if (!existing[0]) {
    await db.insert(governanceAuditQrExpiryPolicies).values({ ownerOpenId, validityMinutes });
    const policy = await getGovernanceAuditQrExpiryPolicy(ownerOpenId);
    return { ...policy, outcome: "updated" as const, historyEvent: null };
  }
  const change = resolveGovernanceAuditQrExpiryPolicyChange(existing[0].validityMinutes, validityMinutes);
  if (change.outcome === "unchanged") {
    return { ...existing[0], outcome: "unchanged" as const, historyEvent: null };
  }
  const changedAt = new Date();
  const eventId = `qrph_${createHash("sha256").update(`${ownerOpenId}:${existing[0].validityMinutes}:${validityMinutes}:${changedAt.toISOString()}`).digest("hex").slice(0, 32)}`;
  await db.update(governanceAuditQrExpiryPolicies).set({ validityMinutes }).where(eq(governanceAuditQrExpiryPolicies.id, existing[0].id));
  await db.insert(governanceAuditQrExpiryPolicyHistory).values({
    ownerOpenId,
    eventId,
    previousValidityMinutes: change.previousValidityMinutes,
    newValidityMinutes: change.resultingValidityMinutes,
    resultingValidityMinutes: change.resultingValidityMinutes,
    changedAt,
    actorOpenId,
  });
  const policy = await getGovernanceAuditQrExpiryPolicy(ownerOpenId);
  const historyEvent = (await db.select().from(governanceAuditQrExpiryPolicyHistory).where(eq(governanceAuditQrExpiryPolicyHistory.eventId, eventId)).limit(1))[0] ?? null;
  return { ...policy, outcome: "updated" as const, historyEvent };
}

export async function listGovernanceAuditQrExpiryPolicyHistory(ownerOpenId: string) {
  const db = await requireDb();
  return db.select().from(governanceAuditQrExpiryPolicyHistory).where(eq(governanceAuditQrExpiryPolicyHistory.ownerOpenId, ownerOpenId)).orderBy(desc(governanceAuditQrExpiryPolicyHistory.changedAt), desc(governanceAuditQrExpiryPolicyHistory.id));
}

export async function getGovernanceAuditQrRevocation(ownerOpenId: string, referenceId: string) {
  const db = await requireDb();
  return (await db.select().from(governanceAuditQrRevocations).where(and(
    eq(governanceAuditQrRevocations.ownerOpenId, ownerOpenId),
    eq(governanceAuditQrRevocations.referenceId, referenceId),
  )).limit(1))[0] ?? null;
}

export async function revokeGovernanceAuditQrReference(input: {
  ownerOpenId: string;
  referenceId: string;
  exportId: string;
  receiptId: string;
  actorOpenId: string;
  reason?: string | null;
  previousStatus: "verified" | "expired";
  revokedAt?: Date;
}) {
  const db = await requireDb();
  const existing = await getGovernanceAuditQrRevocation(input.ownerOpenId, input.referenceId);
  if (existing) return { outcome: "already_revoked" as const, revocation: existing };
  const reason = normalizeGovernanceAuditQrRevocationReason(input.reason);
  const revokedAt = input.revokedAt ?? new Date();
  try {
    await db.insert(governanceAuditQrRevocations).values({
      ownerOpenId: input.ownerOpenId,
      referenceId: input.referenceId,
      exportId: input.exportId,
      receiptId: input.receiptId,
      revokedAt,
      actorOpenId: input.actorOpenId,
      reason,
      previousStatus: input.previousStatus,
      resultingStatus: "revoked",
    });
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    if (isUniqueViolation(candidate)) {
      const duplicate = await getGovernanceAuditQrRevocation(input.ownerOpenId, input.referenceId);
      if (duplicate) return { outcome: "already_revoked" as const, revocation: duplicate };
    }
    throw error;
  }
  const revocation = await getGovernanceAuditQrRevocation(input.ownerOpenId, input.referenceId);
  if (!revocation) throw new Error("Catatan pencabutan QR tidak dapat dibaca kembali.");
  return { outcome: "revoked" as const, revocation };
}

/** Immutable metadata-only representation of a verified receipt for cross-restart audit discovery. */
export type GovernanceAuditVerificationReceiptIndexInput = {
  ownerOpenId: string;
  receiptId: string;
  receiptFormat: "csv" | "pdf";
  receiptSha256: string;
  receiptByteSize: number;
  verificationStatus: "verified";
  verificationAt: Date;
  issuedByOpenId: string;
  exportId: string;
  exportFormat: "csv" | "pdf";
  exportGeneratedAt: Date;
  exportScope: string;
  exportByteSize: number;
  exportSha256: string;
  exportRecordCount: number;
  qrReferenceId: string;
  qrIssuedAt: Date;
  qrExpiresAt: Date;
  policyEventId: string | null;
  policyPreviousValidityMinutes: number | null;
  policyValidityMinutes: number;
  policyDifferenceMinutes: number;
  policyChange: "initial" | "increase" | "decrease" | "unchanged";
};

export async function indexGovernanceAuditVerificationReceipt(input: GovernanceAuditVerificationReceiptIndexInput) {
  const db = await requireDb();
  const readExisting = async () => (await db.select().from(governanceAuditVerificationReceiptIndex).where(and(
    eq(governanceAuditVerificationReceiptIndex.ownerOpenId, input.ownerOpenId),
    eq(governanceAuditVerificationReceiptIndex.receiptSha256, input.receiptSha256),
  )).limit(1))[0] ?? null;
  const existing = await readExisting();
  if (existing) return { outcome: "already_indexed" as const, receipt: existing };
  try {
    await db.insert(governanceAuditVerificationReceiptIndex).values(input);
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    if (!isUniqueViolation(candidate)) throw error;
  }
  const receipt = await readExisting();
  if (!receipt) throw new Error("Indeks receipt verifikasi tidak dapat dibaca kembali.");
  return { outcome: "indexed" as const, receipt };
}

export async function listGovernanceAuditVerificationReceiptIndex(ownerOpenId: string) {
  const db = await requireDb();
  return db.select().from(governanceAuditVerificationReceiptIndex).where(
    eq(governanceAuditVerificationReceiptIndex.ownerOpenId, ownerOpenId),
  ).orderBy(desc(governanceAuditVerificationReceiptIndex.verificationAt), desc(governanceAuditVerificationReceiptIndex.id));
}


/** Phase 2.23 metadata-only retention summary export index (bytes live in durable storage). */
export type RetentionSummaryExportIndexInput = {
  ownerOpenId: string;
  exportId: string;
  format: "csv" | "html" | "pdf";
  storageKey: string;
  sha256: string;
  byteSize: number;
  evaluatedAt: Date;
  scopeLabel: string;
  datePreset: string | null;
  rangeStartDate: string;
  rangeEndDate: string;
  snapshotJson: string;
};

export async function indexRetentionSummaryExport(input: RetentionSummaryExportIndexInput) {
  const db = await requireDb();
  const readExisting = async () => (await db.select().from(retentionSummaryExports).where(and(
    eq(retentionSummaryExports.ownerOpenId, input.ownerOpenId),
    eq(retentionSummaryExports.exportId, input.exportId),
  )).limit(1))[0] ?? null;
  const existing = await readExisting();
  if (existing) return { outcome: "already_indexed" as const, record: existing };
  try {
    await db.insert(retentionSummaryExports).values(input);
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    if (!isUniqueViolation(candidate)) throw error;
  }
  const record = await readExisting();
  if (!record) throw new Error("Indeks ekspor ringkasan retensi tidak dapat dibaca kembali.");
  return { outcome: "indexed" as const, record };
}

/** Owner-scoped lookup: another owner's exportId is indistinguishable from an unknown one. */
export async function getRetentionSummaryExportIndex(ownerOpenId: string, exportId: string) {
  const db = await requireDb();
  return (await db.select().from(retentionSummaryExports).where(and(
    eq(retentionSummaryExports.ownerOpenId, ownerOpenId),
    eq(retentionSummaryExports.exportId, exportId),
  )).limit(1))[0] ?? null;
}

/** Self-hosted object storage (no Manus Forge): write-once exact bytes keyed by a unique storage key. */
export async function putStoredObject(storageKey: string, data: Buffer, contentType: string) {
  const db = await requireDb();
  await db.insert(storedObjects).values({ storageKey, contentType, byteSize: data.byteLength, data });
}
export async function getStoredObject(storageKey: string) {
  const db = await requireDb();
  return (await db.select().from(storedObjects).where(eq(storedObjects.storageKey, storageKey)).limit(1))[0] ?? null;
}

/** Net recipe consumption per ingredient in [start, end): sales/exchange issues minus voids/refunds/returns. */
export async function getIngredientConsumption(start: Date, end: Date) {
  const db = await requireDb();
  const rows = await db.select({ ingredientId: stockMovements.ingredientId, quantityDelta: stockMovements.quantityDelta })
    .from(stockMovements)
    .where(and(gte(stockMovements.occurredAt, start), lt(stockMovements.occurredAt, end), inArray(stockMovements.type, ["sale", "exchange_sale", "void", "refund", "partial_refund", "exchange_return"])));
  const consumption = new Map<number, number>();
  for (const row of rows) consumption.set(row.ingredientId, (consumption.get(row.ingredientId) ?? 0) - row.quantityDelta);
  return consumption;
}
