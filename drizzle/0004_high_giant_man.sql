CREATE TYPE "public"."shopify_auth_mode" AS ENUM('oauth', 'custom');--> statement-breakpoint
ALTER TYPE "public"."platform_action" ADD VALUE 'store.credentials' BEFORE 'user.disable';--> statement-breakpoint
ALTER TYPE "public"."store_status" ADD VALUE 'pending';--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "auth_mode" "shopify_auth_mode" DEFAULT 'oauth' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "api_secret" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "scopes" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "api_version" text;