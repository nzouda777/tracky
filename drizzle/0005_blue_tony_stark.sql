CREATE TYPE "public"."content_alignment" AS ENUM('left', 'center');--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "content_alignment" "content_alignment" DEFAULT 'center' NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "show_store_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "content_width" integer DEFAULT 640 NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "card_radius" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "button_radius" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "button_full_width" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "section_background" text;