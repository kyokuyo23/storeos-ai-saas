import { boolean, customType, index, integer, numeric, pgEnum, pgTable, text, timestamp as pgTimestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * PostgreSQL (Supabase) schema. Ported 1:1 from the original MySQL schema:
 * - TIMESTAMP -> timestamptz(0): exact instants, second precision like MySQL TIMESTAMP.
 * - DECIMAL(p,s) -> numeric(p,s) read as JS numbers.
 * - ENUM columns -> named PostgreSQL enum types.
 * - ON UPDATE CURRENT_TIMESTAMP -> application-side $onUpdate.
 */
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true, precision: 0, mode: "date" });
const int = (name: string) => integer(name);
const id = () => integer("id").primaryKey().generatedByDefaultAsIdentity();
const decimal = (name: string, config: { precision: number; scale: number; mode: "number" }) => numeric(name, { precision: config.precision, scale: config.scale, mode: "number" });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const saleStatus = pgEnum("sale_status", ["completed", "partially_refunded", "voided", "refunded"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card"]);
export const stockMovementType = pgEnum("stock_movement_type", ["purchase", "adjustment", "waste", "opname", "sale", "void", "refund", "partial_refund", "exchange_return", "exchange_sale"]);
export const opnameFollowUpStatus = pgEnum("opname_follow_up_status", ["needs_follow_up", "in_progress", "resolved"]);
export const artifactLifecycleStatus = pgEnum("artifact_lifecycle_status", ["generated", "verified", "retained", "eligible_for_archive", "archived"]);

/** Owner-admin (OWNER_OPEN_ID) and member (staff) accounts. */
export const users = pgTable("users", {
  id: id(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  /** Member (staff) accounts only: login name, scrypt password hash, active flag and a session version
   *  that is bumped on password reset / deactivation to invalidate existing sessions. The owner logs in
   *  with OWNER_PASSWORD and leaves these null. */
  username: varchar("username", { length: 32 }).unique(),
  passwordHash: text("passwordHash"),
  isActive: boolean("isActive").default(true).notNull(),
  sessionVersion: integer("sessionVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const products = pgTable("products", {
  id: id(),
  categoryId: int("categoryId").notNull().references(() => categories.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 80 }).unique(),
  description: text("description"),
  sellingPrice: decimal("sellingPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  costPrice: decimal("costPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("products_category_idx").on(table.categoryId)]);

export const ingredients = pgTable("ingredients", {
  id: id(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  unit: varchar("unit", { length: 40 }).notNull(),
  costPerUnit: decimal("costPerUnit", { precision: 14, scale: 2, mode: "number" }).notNull(),
  minimumStock: decimal("minimumStock", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currentStock: decimal("currentStock", { precision: 14, scale: 3, mode: "number" }).default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const sales = pgTable("sales", {
  id: id(),
  receiptNumber: varchar("receiptNumber", { length: 64 }).notNull().unique(),
  status: saleStatus("status").default("completed").notNull(),
  total: decimal("total", { precision: 14, scale: 2, mode: "number" }).notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  reversedAt: timestamp("reversedAt"),
  reversalReason: text("reversalReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const saleItems = pgTable("saleItems", {
  id: id(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("sale_items_sale_idx").on(table.saleId), index("sale_items_product_idx").on(table.productId)]);

/** Immutable per-unit recipe snapshot, retained so refunds follow the recipe used at sale time. */
export const saleItemIngredients = pgTable("saleItemIngredients", {
  id: id(),
  saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  unitQuantity: decimal("unitQuantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  /** Immutable ingredient unit cost captured when the sale is completed. */
  unitCost: decimal("unitCost", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("sale_item_ingredients_item_idx").on(table.saleItemId), index("sale_item_ingredients_ingredient_idx").on(table.ingredientId)]);

export const partialRefunds = pgTable("partialRefunds", {
  id: id(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("partial_refunds_sale_idx").on(table.saleId), index("partial_refunds_item_idx").on(table.saleItemId)]);

/** A return from one original sale line combined with one or more replacement products. */
export const exchanges = pgTable("exchanges", {
  id: id(),
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
export const exchangeItems = pgTable("exchangeItems", {
  id: id(),
  exchangeId: int("exchangeId").notNull().references(() => exchanges.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2, mode: "number" }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("exchange_items_exchange_idx").on(table.exchangeId), index("exchange_items_product_idx").on(table.productId)]);

/** Immutable per-unit recipe snapshot for each replacement product issued in an exchange. */
export const exchangeItemIngredients = pgTable("exchangeItemIngredients", {
  id: id(),
  exchangeItemId: int("exchangeItemId").notNull().references(() => exchangeItems.id, { onDelete: "restrict" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  unitQuantity: decimal("unitQuantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  /** Immutable ingredient unit cost captured when the replacement product is issued. */
  unitCost: decimal("unitCost", { precision: 14, scale: 2, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("exchange_item_ingredients_item_idx").on(table.exchangeItemId), index("exchange_item_ingredients_ingredient_idx").on(table.ingredientId)]);

/** A single full payment collected when an exchange has a positive payment adjustment. */
export const exchangeSettlements = pgTable("exchangeSettlements", {
  id: id(),
  exchangeId: int("exchangeId").notNull().unique().references(() => exchanges.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  paymentMethod: paymentMethod("paymentMethod").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stockMovements = pgTable("stockMovements", {
  id: id(),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  saleId: int("saleId").references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: int("saleItemId").references(() => saleItems.id, { onDelete: "restrict" }),
  partialRefundId: int("partialRefundId").references(() => partialRefunds.id, { onDelete: "restrict" }),
  exchangeId: int("exchangeId").references(() => exchanges.id, { onDelete: "restrict" }),
  type: stockMovementType("type").notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 14, scale: 3, mode: "number" }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 3, mode: "number" }).notNull(),
  note: text("note"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("stock_movements_ingredient_occurred_idx").on(table.ingredientId, table.occurredAt), index("stock_movements_sale_idx").on(table.saleId), index("stock_movements_sale_item_idx").on(table.saleItemId), index("stock_movements_exchange_idx").on(table.exchangeId)]);

/** Follow-up metadata only; the immutable inventory audit remains in stockMovements. */
export const stockOpnameFollowUps = pgTable("stockOpnameFollowUps", {
  id: id(),
  auditReference: varchar("auditReference", { length: 80 }).notNull().unique(),
  status: opnameFollowUpStatus("status").default("needs_follow_up").notNull(),
  followUpNote: text("followUpNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const monthlyReportArtifacts = pgTable("monthlyReportArtifacts", {
  id: id(),
  /** The single-store owner identity. Legacy Phase 2.2 rows use the safe legacy scope. */
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).default("legacy-single-store").notNull(),
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
  pdfKey: varchar("pdfKey", { length: 512 }).notNull(),
  pdfUrl: varchar("pdfUrl", { length: 512 }).notNull(),
  pdfSha256: varchar("pdfSha256", { length: 64 }).notNull(),
  pdfBytes: int("pdfBytes").notNull(),
  /** Governance state is additive and never changes the immutable report content. */
  lifecycleStatus: artifactLifecycleStatus("lifecycleStatus").default("retained").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  retainedAt: timestamp("retainedAt"),
  archiveEligibleAt: timestamp("archiveEligibleAt"),
  archivedAt: timestamp("archivedAt"),
  archiveReason: varchar("archiveReason", { length: 160 }),
  /** Logical retention removal preserves immutable metadata while permanently revoking application access. */
  retiredAt: timestamp("retiredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("monthly_report_artifacts_period_owner_unique").on(table.ownerOpenId, table.year, table.month),
  index("monthly_report_artifacts_owner_retired_idx").on(table.ownerOpenId, table.retiredAt),
  index("monthly_report_artifacts_owner_lifecycle_idx").on(table.ownerOpenId, table.lifecycleStatus, table.retiredAt),
  index("monthly_report_artifacts_owner_archive_due_idx").on(table.ownerOpenId, table.archiveEligibleAt),
]);

/** Immutable lifecycle audit trail for managed report artifacts. */
export const monthlyReportArtifactLifecycleEvents = pgTable("monthlyReportArtifactLifecycleEvents", {
  id: id(),
  artifactId: int("artifactId").notNull().references(() => monthlyReportArtifacts.id, { onDelete: "restrict" }),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  lifecycleStatus: artifactLifecycleStatus("lifecycleStatus").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  reason: varchar("reason", { length: 160 }),
  /** Application-generated actor label; no credential or storage identity is recorded. */
  actor: varchar("actor", { length: 80 }).default("system").notNull(),
  /** Originating application capability, for example monthly_scheduler or retention_policy. */
  source: varchar("source", { length: 80 }).default("system").notNull(),
  /** Events govern the immutable CSV, HTML, and PDF bundle together. */
  artifactFormat: varchar("artifactFormat", { length: 24 }).default("bundle").notNull(),
  /** Snapshot of non-sensitive SHA-256/size metadata at transition time. */
  integritySnapshot: text("integritySnapshot"),
  /** New application events use a deterministic key; legacy history remains readable with NULL. */
  eventKey: varchar("eventKey", { length: 191 }),
}, (table) => [
  index("monthly_report_artifact_lifecycle_artifact_idx").on(table.artifactId, table.occurredAt),
  index("monthly_report_artifact_lifecycle_owner_idx").on(table.ownerOpenId, table.lifecycleStatus, table.occurredAt),
  uniqueIndex("monthly_report_artifact_lifecycle_event_key_unique").on(table.artifactId, table.eventKey),
]);

export const recipes = pgTable("recipes", {
  id: id(),
  productId: int("productId").notNull().unique().references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const recipeItems = pgTable("recipeItems", {
  id: id(),
  recipeId: int("recipeId").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: int("ingredientId").notNull().references(() => ingredients.id, { onDelete: "restrict" }),
  quantity: decimal("quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("recipe_items_recipe_idx").on(table.recipeId), index("recipe_items_ingredient_idx").on(table.ingredientId)]);

export const businessSettings = pgTable("businessSettings", {
  id: id(),
  businessName: varchar("businessName", { length: 160 }).notNull(),
  storeLocation: varchar("storeLocation", { length: 200 }).notNull(),
  currency: varchar("currency", { length: 12 }).notNull(),
  timezone: varchar("timezone", { length: 80 }).notNull(),
  opnameWarningAgeDays: int("opnameWarningAgeDays").default(3).notNull(),
  opnameCriticalAgeDays: int("opnameCriticalAgeDays").default(7).notNull(),
  inventoryVarianceAbsoluteTolerance: decimal("inventoryVarianceAbsoluteTolerance", { precision: 14, scale: 3, mode: "number" }).default(0.001).notNull(),
  inventoryVariancePercentageTolerance: decimal("inventoryVariancePercentageTolerance", { precision: 6, scale: 3, mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const governanceAuditQrExpiryPolicies = pgTable("governanceAuditQrExpiryPolicies", {
  id: id(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  validityMinutes: int("validityMinutes").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [uniqueIndex("governance_audit_qr_expiry_owner_unique").on(table.ownerOpenId)]);

/** Append-only owner audit trail for effective Governance Audit QR expiry-policy changes. */
export const governanceAuditQrExpiryPolicyHistory = pgTable("governanceAuditQrExpiryPolicyHistory", {
  id: id(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  eventId: varchar("eventId", { length: 48 }).notNull(),
  previousValidityMinutes: int("previousValidityMinutes").notNull(),
  newValidityMinutes: int("newValidityMinutes").notNull(),
  resultingValidityMinutes: int("resultingValidityMinutes").notNull(),
  changedAt: timestamp("changedAt").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
}, (table) => [
  uniqueIndex("governance_audit_qr_expiry_history_event_unique").on(table.eventId),
  index("governance_audit_qr_expiry_history_owner_changed_idx").on(table.ownerOpenId, table.changedAt),
]);

/** Immutable governance state for a single opaque QR verification reference. */
export const governanceAuditQrRevocations = pgTable("governanceAuditQrRevocations", {
  id: id(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  referenceId: varchar("referenceId", { length: 40 }).notNull(),
  exportId: varchar("exportId", { length: 128 }).notNull(),
  receiptId: varchar("receiptId", { length: 160 }).notNull(),
  revokedAt: timestamp("revokedAt").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  reason: text("reason"),
  previousStatus: varchar("previousStatus", { length: 24 }).notNull(),
  resultingStatus: varchar("resultingStatus", { length: 24 }).default("revoked").notNull(),
}, (table) => [
  uniqueIndex("governance_audit_qr_revocation_owner_reference_unique").on(table.ownerOpenId, table.referenceId),
  index("governance_audit_qr_revocation_owner_revoked_idx").on(table.ownerOpenId, table.revokedAt),
]);

/**
 * Immutable owner-scoped index for real receipts that were issued after an
 * exact-byte governance export verification. This intentionally stores only
 * query metadata and integrity descriptors, never the downloadable bytes.
 */
export const governanceAuditVerificationReceiptIndex = pgTable("governanceAuditVerificationReceiptIndex", {
  id: id(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  receiptId: varchar("receiptId", { length: 160 }).notNull(),
  receiptFormat: varchar("receiptFormat", { length: 8 }).notNull(),
  receiptSha256: varchar("receiptSha256", { length: 64 }).notNull(),
  receiptByteSize: int("receiptByteSize").notNull(),
  verificationStatus: varchar("verificationStatus", { length: 24 }).notNull(),
  verificationAt: timestamp("verificationAt").notNull(),
  issuedByOpenId: varchar("issuedByOpenId", { length: 64 }).notNull(),
  exportId: varchar("exportId", { length: 128 }).notNull(),
  exportFormat: varchar("exportFormat", { length: 8 }).notNull(),
  exportGeneratedAt: timestamp("exportGeneratedAt").notNull(),
  exportScope: varchar("exportScope", { length: 512 }).notNull(),
  exportByteSize: int("exportByteSize").notNull(),
  exportSha256: varchar("exportSha256", { length: 64 }).notNull(),
  exportRecordCount: int("exportRecordCount").notNull(),
  qrReferenceId: varchar("qrReferenceId", { length: 40 }).notNull(),
  qrIssuedAt: timestamp("qrIssuedAt").notNull(),
  qrExpiresAt: timestamp("qrExpiresAt").notNull(),
  policyEventId: varchar("policyEventId", { length: 48 }),
  policyPreviousValidityMinutes: int("policyPreviousValidityMinutes"),
  policyValidityMinutes: int("policyValidityMinutes").notNull(),
  policyDifferenceMinutes: int("policyDifferenceMinutes").notNull(),
  policyChange: varchar("policyChange", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("governance_audit_receipt_index_owner_sha_unique").on(table.ownerOpenId, table.receiptSha256),
  index("governance_audit_receipt_index_owner_verified_idx").on(table.ownerOpenId, table.verificationAt),
  index("governance_audit_receipt_index_owner_qr_idx").on(table.ownerOpenId, table.qrReferenceId),
  index("governance_audit_receipt_index_owner_policy_event_idx").on(table.ownerOpenId, table.policyEventId),
]);

/** Phase 2.23: metadata-only index of retention summary exports; artifact bytes stay in durable storage. */
export const retentionSummaryExports = pgTable("retentionSummaryExports", {
  id: id(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  exportId: varchar("exportId", { length: 128 }).notNull(),
  format: varchar("format", { length: 8 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  byteSize: int("byteSize").notNull(),
  evaluatedAt: timestamp("evaluatedAt").notNull(),
  scopeLabel: varchar("scopeLabel", { length: 64 }).notNull(),
  datePreset: varchar("datePreset", { length: 32 }),
  rangeStartDate: varchar("rangeStartDate", { length: 10 }).notNull(),
  rangeEndDate: varchar("rangeEndDate", { length: 10 }).notNull(),
  snapshotJson: text("snapshotJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("retention_summary_exports_owner_export_unique").on(table.ownerOpenId, table.exportId),
  index("retention_summary_exports_owner_evaluated_idx").on(table.ownerOpenId, table.evaluatedAt),
]);

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
/** Self-hosted storage fallback (used when Manus Forge storage is not configured): exact bytes, private to the server. */
export const storedObjects = pgTable("storedObjects", {
  id: id(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  byteSize: int("byteSize").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("stored_objects_key_unique").on(table.storageKey),
]);

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type MonthlyReportArtifact = typeof monthlyReportArtifacts.$inferSelect;
export type RetentionSummaryExportRow = typeof retentionSummaryExports.$inferSelect;

export type StoredObjectRow = typeof storedObjects.$inferSelect;
