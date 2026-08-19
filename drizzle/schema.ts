import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type BusinessSettings = typeof businessSettings.$inferSelect;
