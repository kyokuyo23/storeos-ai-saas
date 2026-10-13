ALTER TABLE "users" ADD COLUMN "username" varchar(32);
ALTER TABLE "users" ADD COLUMN "passwordHash" text;
ALTER TABLE "users" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "sessionVersion" integer DEFAULT 1 NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");