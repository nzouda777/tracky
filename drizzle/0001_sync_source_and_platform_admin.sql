ALTER TYPE "public"."stage_event_source" ADD VALUE 'shopify_sync' BEFORE 'agency';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;