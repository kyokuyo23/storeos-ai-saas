import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Retained for framework compatibility; the Step 2 user experience has no authentication screens. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 80 }).unique(),
  description: text("description"),
  sellingPrice: decimal("sellingPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  costPrice: decimal("costPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("products_category_idx").on(table.categoryId)]);

export const ingredients = mysqlTable("ingredients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  unit: varchar("unit", { length: 40 }).notNull(),
  costPerUnit: decimal("costPerUnit", { precision: 14, scale: 2, mode: "number" }).notNull(),
  minimumStock: decimal("minimumStock", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currentStock: decimal("currentStock", { precision: 14, scale: 3, mode: "number" }).default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  receiptNumber: varchar("receiptNumber", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["completed", "partially_refunded", "voided", "refunded"]).default("completed").notNull(),
  total: decimal("total", { precision: 14, scale: 2, mode: "number" }).notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  reversedAt: timestamp("reversedAt"),
  reversalReason: text("reversalReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("sale_items_sale_idx").on(table.saleId), index("sale_items_product_idx").on(table.productId)]);

/** Immutable per-unit recipe snapshot, retained so refunds follow the recipe used at sale time. */
export const saleItemIngredients = mysqlTable("saleItemIngredients", {
  id: int("id").autoincrement().primaryKey(),
  saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  unitQuantity: decimal("unitQuantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  /** Immutable ingredient unit cost captured when the sale is completed. */
  unitCost: decimal("unitCost", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("sale_item_ingredients_item_idx").on(table.saleItemId), index("sale_item_ingredients_ingredient_idx").on(table.ingredientId)]);

export const partialRefunds = mysqlTable("partialRefunds", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("partial_refunds_sale_idx").on(table.saleId), index("partial_refunds_item_idx").on(table.saleItemId)]);

/** A return from one original sale line combined with one or more replacement products. */
export const exchanges = mysqlTable("exchanges", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
  returnedQuantity: int("returnedQuantity").notNull(),
  returnedTotal: decimal("returnedTotal", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  replacementTotal: decimal("replacementTotal", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentAdjustment: decimal("paymentAdjustment", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("exchanges_sale_idx").on(table.saleId), index("exchanges_sale_item_idx").on(table.saleItemId)]);

/** Replacement products issued in an exchange, with their sale-time price snapshots. */
export const exchangeItems = mysqlTable("exchangeItems", {
  id: int("id").autoincrement().primaryKey(),
  exchangeId: int("exchangeId").notNull().references(() => exchanges.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("exchange_items_exchange_idx").on(table.exchangeId), index("exchange_items_product_idx").on(table.productId)]);

/** Immutable per-unit recipe snapshot for each replacement product issued in an exchange. */
export const exchangeItemIngredients = mysqlTable("exchangeItemIngredients", {
  id: int("id").autoincrement().primaryKey(),
  exchangeItemId: int("exchangeItemId").notNull().references(() => exchangeItems.id, { onDelete: "restrict" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  unitQuantity: decimal("unitQuantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  /** Immutable ingredient unit cost captured when the replacement product is issued. */
  unitCost: decimal("unitCost", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("exchange_item_ingredients_item_idx").on(table.exchangeItemId), index("exchange_item_ingredients_ingredient_idx").on(table.ingredientId)]);

/** A single full payment collected when an exchange has a positive payment adjustment. */
export const exchangeSettlements = mysqlTable("exchangeSettlements", {
  id: int("id").autoincrement().primaryKey(),
  exchangeId: int("exchangeId").notNull().unique().references(() => exchanges.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  saleId: int("saleId").references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: int("saleItemId").references(() => saleItems.id, { onDelete: "restrict" }),
  partialRefundId: int("partialRefundId").references(() => partialRefunds.id, { onDelete: "restrict" }),
  exchangeId: int("exchangeId").references(() => exchanges.id, { onDelete: "restrict" }),
  type: mysqlEnum("type", ["purchase", "adjustment", "waste", "opname", "sale", "void", "refund", "partial_refund", "exchange_return", "exchange_sale"]).notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 14, scale: 3, mode: "number" }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 3, mode: "number" }).notNull(),
  note: text("note"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("stock_movements_ingredient_occurred_idx").on(table.ingredientId, table.occurredAt), index("stock_movements_sale_idx").on(table.saleId), index("stock_movements_sale_item_idx").on(table.saleItemId), index("stock_movements_exchange_idx").on(table.exchangeId)]);

/** Follow-up metadata only; the immutable inventory audit remains in stockMovements. */
export const stockOpnameFollowUps = mysqlTable("stockOpnameFollowUps", {
  id: int("id").autoincrement().primaryKey(),
  auditReference: varchar("auditReference", { length: 80 }).notNull().unique(),
  status: mysqlEnum("status", ["needs_follow_up", "in_progress", "resolved"]).default("needs_follow_up").notNull(),
  followUpNote: text("followUpNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const monthlyReportArtifacts = mysqlTable("monthlyReportArtifacts", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull(),
  periodStartDate: varchar("periodStartDate", { length: 10 }).notNull(),
  periodEndDate: varchar("periodEndDate", { length: 10 }).notNull(),
  generatedAt: timestamp("generatedAt").notNull(),
  csvKey: varchar("csvKey", { length: 512 }).notNull(),
  csvUrl: varchar("csvUrl", { length: 512 }).notNull(),
  csvSha256: varchar("csvSha256", { length: 64 }).notNull(),
  csvBytes: int("csvBytes").notNull(),
  htmlKey: varchar("htmlKey", { length: 512 }).notNull(),
  htmlUrl: varchar("htmlUrl", { length: 512 }).notNull(),
  htmlSha256: varchar("htmlSha256", { length: 64 }).notNull(),
  htmlBytes: int("htmlBytes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("monthly_report_artifacts_period_unique").on(table.year, table.month)]);

export const recipes = mysqlTable("recipes", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique().references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const recipeItems = mysqlTable("recipeItems", {
  id: int("id").autoincrement().primaryKey(),
  recipeId: int("recipeId").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  quantity: decimal("quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("recipe_items_recipe_idx").on(table.recipeId), index("recipe_items_ingredient_idx").on(table.ingredientId)]);

export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  businessName: varchar("businessName", { length: 160 }).notNull(),
  storeLocation: varchar("storeLocation", { length: 200 }).notNull(),
  currency: varchar("currency", { length: 12 }).notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull(),
  opnameWarningAgeDays: int("opnameWarningAgeDays").default(3).notNull(),
  opnameCriticalAgeDays: int("opnameCriticalAgeDays").default(7).notNull(),
  inventoryVarianceAbsoluteTolerance: decimal("inventoryVarianceAbsoluteTolerance", { precision: 14, scale: 3, mode: "number" }).default(0.001).notNull(),
  inventoryVariancePercentageTolerance: decimal("inventoryVariancePercentageTolerance", { precision: 6, scale: 3, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type StockOpnameFollowUp = typeof stockOpnameFollowUps.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type SaleItemIngredient = typeof saleItemIngredients.$inferSelect;
export type PartialRefund = typeof partialRefunds.$inferSelect;
export type Exchange = typeof exchanges.$inferSelect;
export type ExchangeItem = typeof exchangeItems.$inferSelect;
export type ExchangeItemIngredient = typeof exchangeItemIngredients.$inferSelect;
export type ExchangeSettlement = typeof exchangeSettlements.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type BusinessSettings = typeof businessSettings.$inferSelect;
export type MonthlyReportArtifact = typeof monthlyReportArtifacts.$inferSelect;
