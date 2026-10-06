ALTER TYPE "public"."stage_event_source" ADD VALUE 'automatic';--> statement-breakpoint
CREATE TABLE "auto_advance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"delay_hours" integer DEFAULT 24 NOT NULL,
	"stop_at_stage_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_advance_settings" ADD CONSTRAINT "auto_advance_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_advance_settings" ADD CONSTRAINT "auto_advance_settings_stop_at_stage_id_stages_id_fk" FOREIGN KEY ("stop_at_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auto_advance_settings_store_key" ON "auto_advance_settings" USING btree ("store_id");