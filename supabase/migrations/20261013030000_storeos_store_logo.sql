ALTER TABLE "businessSettings" ADD COLUMN "logoStorageKey" varchar(512);
ALTER TABLE "businessSettings" ADD COLUMN "logoUpdatedAt" timestamp (0) with time zone;