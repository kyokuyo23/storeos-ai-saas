import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import * as db from "./db";
import { mapFoundationError } from "./foundationErrors";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { categoryInput, exchangeInput, exchangeSettlementInput, ingredientInput, partialRefundInput, productInput, recipeInput, saleCompletionInput, saleReversalInput, settingsInput, stockMovementInput } from "./foundationSchemas";

const idInput = z.object({ id: z.number().int().positive() });
const runMutation = async <T>(entity: string, operation: () => Promise<T>) => {
  try { return await operation(); } catch (error) { throw mapFoundationError(error, entity); }
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  category: router({
    list: publicProcedure.query(() => db.listCategories()),
    create: publicProcedure.input(categoryInput).mutation(({ input }) => runMutation("Kategori", () => db.createCategory(input))),
  }),
  product: router({
    list: publicProcedure.query(() => db.listProducts()),
    create: publicProcedure.input(productInput).mutation(({ input }) => runMutation("Produk", () => db.createProduct(input))),
    update: publicProcedure.input(idInput.extend({ data: productInput })).mutation(({ input }) => runMutation("Produk", () => db.updateProduct(input.id, input.data))),
  }),
  ingredient: router({
    list: publicProcedure.query(() => db.listIngredients()),
    create: publicProcedure.input(ingredientInput).mutation(({ input }) => runMutation("Bahan", () => db.createIngredient(input))),
    update: publicProcedure.input(idInput.extend({ data: ingredientInput })).mutation(({ input }) => runMutation("Bahan", () => db.updateIngredient(input.id, input.data))),
  }),
  stockMovement: router({
    list: publicProcedure.query(() => db.listStockMovements()),
    record: publicProcedure.input(stockMovementInput).mutation(({ input }) => runMutation("Pergerakan stok", () => db.recordStockMovement(input))),
  }),
  recipe: router({
    list: publicProcedure.query(() => db.listRecipes()),
    save: publicProcedure.input(recipeInput).mutation(({ input }) => runMutation("Resep", () => db.saveRecipe(input))),
  }),
  sale: router({
    list: publicProcedure.query(() => db.listSales()),
    complete: publicProcedure.input(saleCompletionInput).mutation(({ input }) => runMutation("Penjualan", () => db.completeSale(input))),
    reverse: publicProcedure.input(saleReversalInput).mutation(({ input }) => runMutation("Pembatalan transaksi", () => db.reverseSale(input))),
    partialRefund: publicProcedure.input(partialRefundInput).mutation(({ input }) => runMutation("Refund sebagian", () => db.partialRefundSaleItem(input))),
    exchange: publicProcedure.input(exchangeInput).mutation(({ input }) => runMutation("Penukaran item", () => db.exchangeSaleItem(input))),
    settleExchange: publicProcedure.input(exchangeSettlementInput).mutation(({ input }) => runMutation("Pembayaran penukaran", () => db.settleExchange(input))),
  }),
  settings: router({
    get: publicProcedure.query(() => db.getSettings()),
    update: publicProcedure.input(settingsInput).mutation(({ input }) => runMutation("Pengaturan", () => db.updateSettings(input))),
  }),
});
export type AppRouter = typeof appRouter;
