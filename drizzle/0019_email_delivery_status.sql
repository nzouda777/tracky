ALTER TABLE "email_sends" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "delivery_detail" text;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "delivery_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "email_sends_provider_message_idx" ON "email_sends" USING btree ("provider_message_id");