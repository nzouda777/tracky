ALTER TABLE "auto_advance_settings" ADD COLUMN "sub_stage_delay_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_advance_settings" ADD COLUMN "emails_main_stages_only" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_advance_settings" ADD COLUMN "emails_since" timestamp with time zone;