ALTER TABLE "businessSettings" ADD COLUMN "logoStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "businessSettings" ADD COLUMN "logoUpdatedAt" timestamp (0) with time zone;