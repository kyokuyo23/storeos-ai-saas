import { and, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { businessSettings, categories, exchangeItemIngredients, exchangeItems, exchanges, exchangeSettlements, ingredients, InsertUser, partialRefunds, products, recipeItems, recipes, saleItemIngredients, saleItems, sales, stockMovements, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { z } from "zod";
import type { categoryInput, exchangeInput, exchangeSettlementInput, ingredientInput, partialRefundInput, productInput, recipeInput, saleCompletionInput, saleReversalInput, settingsInput, stockMovementInput } from "./foundationSchemas";
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
  return db.select({ id: stockMovements.id, ingredientId: stockMovements.ingredientId, ingredientName: ingredients.name, unit: ingredients.unit, saleId: stockMovements.saleId, saleItemId: stockMovements.saleItemId, partialRefundId: stockMovements.partialRefundId, exchangeId: stockMovements.exchangeId, saleReceiptNumber: sales.receiptNumber, saleItemProductName: products.name, type: stockMovements.type, quantityDelta: stockMovements.quantityDelta, balanceAfter: stockMovements.balanceAfter, note: stockMovements.note, occurredAt: stockMovements.occurredAt }).from(stockMovements).innerJoin(ingredients, eq(stockMovements.ingredientId, ingredients.id)).leftJoin(sales, eq(stockMovements.saleId, sales.id)).leftJoin(saleItems, eq(stockMovements.saleItemId, saleItems.id)).leftJoin(products, eq(saleItems.productId, products.id)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
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
  const saleLineRecords: Array<{ saleItemId: number; productId: number; quantity: number }> = [];
  for (const line of lines) {
    const product = productById.get(line.productId)!;
    const saleItemResult = await tx.insert(saleItems).values({ saleId, productId: product.id, quantity: line.quantity, unitPrice: product.sellingPrice, lineTotal: Number((product.sellingPrice * line.quantity).toFixed(2)) });
    const saleItemId = Number(saleItemResult[0].insertId);
    saleLineRecords.push({ saleItemId, productId: product.id, quantity: line.quantity });
    const recipe = recipesForSale.find((candidate) => candidate.productId === product.id)!;
    await tx.insert(saleItemIngredients).values(recipe.items.map((item) => ({ saleItemId, ingredientId: item.ingredientId, unitQuantity: item.quantity })));
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
  const refundResult = await tx.insert(partialRefunds).values({ saleId: sale.id, saleItemId: saleItem.id, quantity: input.quantity, reason: input.reason || null });
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
  const returnedRecipe = await tx.select().from(saleItemIngredients).where(eq(saleItemIngredients.saleItemId, saleItem.id)) as Array<{ ingredientId: number; unitQuantity: number }>;
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
  const ingredientRows = await tx.select().from(ingredients).where(inArray(ingredients.id, ingredientIds)) as Array<{ id: number; name: string; currentStock: number; isActive: boolean }>;
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
  const exchangeResult = await tx.insert(exchanges).values({ saleId: sale.id, saleItemId: saleItem.id, returnedQuantity: input.returnedQuantity, returnedTotal, replacementTotal, paymentAdjustment, reason: input.reason || null });
  const exchangeId = Number(exchangeResult[0].insertId);
  const issuedItems: Array<{ exchangeItemId: number; productId: number; quantity: number }> = [];
  for (const line of replacementLines) {
    const product = productById.get(line.productId)!;
    const exchangeItemResult = await tx.insert(exchangeItems).values({ exchangeId, productId: product.id, quantity: line.quantity, unitPrice: product.sellingPrice, lineTotal: Number((product.sellingPrice * line.quantity).toFixed(2)) });
    const exchangeItemId = Number(exchangeItemResult[0].insertId);
    issuedItems.push({ exchangeItemId, productId: product.id, quantity: line.quantity });
    const recipe = replacementRecipes.find((candidate) => candidate.productId === product.id)!;
    await tx.insert(exchangeItemIngredients).values(replacementRecipeItems.filter((item) => item.recipeId === recipe.id).map((item) => ({ exchangeItemId, ingredientId: item.ingredientId, unitQuantity: item.quantity })));
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
  const result = await tx.insert(exchangeSettlements).values({ exchangeId: exchange.id, amount: exchange.paymentAdjustment, paymentMethod: input.paymentMethod });
  return { id: Number(result[0].insertId), exchangeId: exchange.id, amount: exchange.paymentAdjustment, paymentMethod: input.paymentMethod };
}
export async function settleExchangeWithClient(client: { transaction: (callback: (tx: any) => Promise<any>) => Promise<any> }, input: z.infer<typeof exchangeSettlementInput>) { return client.transaction((tx) => settleExchangeInTransaction(tx, input)); }
export async function settleExchange(input: z.infer<typeof exchangeSettlementInput>) { return settleExchangeWithClient(await requireDb() as any, input); }

export async function listSales() {
  const db = await requireDb();
  const saleRows = await db.select({ id: sales.id, receiptNumber: sales.receiptNumber, status: sales.status, total: sales.total, completedAt: sales.completedAt, reversedAt: sales.reversedAt, reversalReason: sales.reversalReason, itemCount: count(saleItems.id) }).from(sales).leftJoin(saleItems, eq(saleItems.saleId, sales.id)).groupBy(sales.id, sales.receiptNumber, sales.status, sales.total, sales.completedAt, sales.reversedAt, sales.reversalReason).orderBy(desc(sales.completedAt), desc(sales.id));
  const saleIds = saleRows.map((sale) => sale.id);
  if (!saleIds.length) return saleRows.map((sale) => ({ ...sale, lines: [] }));
  const itemRows = await db.select({ id: saleItems.id, saleId: saleItems.saleId, productId: saleItems.productId, productName: products.name, quantity: saleItems.quantity, unitPrice: saleItems.unitPrice, lineTotal: saleItems.lineTotal }).from(saleItems).innerJoin(products, eq(saleItems.productId, products.id)).where(inArray(saleItems.saleId, saleIds)).orderBy(saleItems.id);
  const refundRows = await db.select({ id: partialRefunds.id, saleId: partialRefunds.saleId, saleItemId: partialRefunds.saleItemId, quantity: partialRefunds.quantity, reason: partialRefunds.reason, createdAt: partialRefunds.createdAt }).from(partialRefunds).where(inArray(partialRefunds.saleId, saleIds)).orderBy(partialRefunds.createdAt, partialRefunds.id);
  const exchangeRows = await db.select({ id: exchanges.id, saleId: exchanges.saleId, saleItemId: exchanges.saleItemId, returnedQuantity: exchanges.returnedQuantity, returnedTotal: exchanges.returnedTotal, replacementTotal: exchanges.replacementTotal, paymentAdjustment: exchanges.paymentAdjustment, reason: exchanges.reason, createdAt: exchanges.createdAt }).from(exchanges).where(inArray(exchanges.saleId, saleIds)).orderBy(exchanges.createdAt, exchanges.id);
  const exchangeIds = exchangeRows.map((exchange) => exchange.id);
  const exchangeItemRows = exchangeIds.length ? await db.select({ exchangeId: exchangeItems.exchangeId, productName: products.name, quantity: exchangeItems.quantity, unitPrice: exchangeItems.unitPrice, lineTotal: exchangeItems.lineTotal }).from(exchangeItems).innerJoin(products, eq(exchangeItems.productId, products.id)).where(inArray(exchangeItems.exchangeId, exchangeIds)).orderBy(exchangeItems.id) : [];
  const settlementRows = exchangeIds.length ? await db.select({ id: exchangeSettlements.id, exchangeId: exchangeSettlements.exchangeId, amount: exchangeSettlements.amount, paymentMethod: exchangeSettlements.paymentMethod, createdAt: exchangeSettlements.createdAt }).from(exchangeSettlements).where(inArray(exchangeSettlements.exchangeId, exchangeIds)).orderBy(exchangeSettlements.createdAt, exchangeSettlements.id) : [];
  return saleRows.map((sale) => ({ ...sale, lines: itemRows.filter((item) => item.saleId === sale.id).map((item) => {
    const refunds = refundRows.filter((refund) => refund.saleItemId === item.id);
    const itemExchanges = exchangeRows.filter((exchange) => exchange.saleItemId === item.id).map((exchange) => ({ ...exchange, items: exchangeItemRows.filter((exchangeItem) => exchangeItem.exchangeId === exchange.id), settlement: settlementRows.find((settlement) => settlement.exchangeId === exchange.id) || null }));
    const refundedQuantity = refunds.reduce((sum, refund) => sum + refund.quantity, 0);
    const exchangedQuantity = itemExchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
    return { ...item, refundedQuantity, exchangedQuantity, refundableQuantity: item.quantity - refundedQuantity - exchangedQuantity, partialRefunds: refunds, exchanges: itemExchanges };
  }) }));
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
