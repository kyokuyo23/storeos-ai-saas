-- Supabase exposes the public schema through its Data API (PostgREST) using the anon/authenticated keys.
-- StoreOS never uses that API: the server connects as the table owner, which bypasses RLS.
-- Enabling RLS with no policies therefore blocks Data API access to every table without affecting the app.
ALTER TABLE "businessSettings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exchangeItemIngredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exchangeItems" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exchangeSettlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exchanges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governanceAuditQrExpiryPolicies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governanceAuditQrExpiryPolicyHistory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governanceAuditQrRevocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governanceAuditVerificationReceiptIndex" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthlyReportArtifactLifecycleEvents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "monthlyReportArtifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partialRefunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipeItems" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retentionSummaryExports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saleItemIngredients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saleItems" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stockMovements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stockOpnameFollowUps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storedObjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
