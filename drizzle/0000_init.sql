CREATE TYPE "public"."email_send_status" AS ENUM('scheduled', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('unfulfilled', 'partial', 'fulfilled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'agency');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."sequence_trigger_type" AS ENUM('on_stage', 'delay_after_order', 'delay_after_previous');--> statement-breakpoint
CREATE TYPE "public"."stage_event_source" AS ENUM('shopify_webhook', 'agency', 'admin');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('active', 'uninstalled');--> statement-breakpoint
CREATE TABLE "branding_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"primary_color" text DEFAULT '#111827' NOT NULL,
	"secondary_color" text DEFAULT '#6b7280' NOT NULL,
	"background_color" text DEFAULT '#ffffff' NOT NULL,
	"text_color" text DEFAULT '#111827' NOT NULL,
	"accent_color" text DEFAULT '#2563eb' NOT NULL,
	"logo_url" text,
	"font_family" text DEFAULT 'ui-sans-serif, system-ui, -apple-system, ''Segoe UI'', Roboto, sans-serif' NOT NULL,
	"base_font_size" integer DEFAULT 16 NOT NULL,
	"heading_font_size" integer DEFAULT 24 NOT NULL,
	"page_title" text DEFAULT 'Track your order' NOT NULL,
	"page_subtitle" text DEFAULT 'Enter your details to see the latest delivery update.' NOT NULL,
	"help_banner_text" text DEFAULT 'Need help with your order? Contact our support team.' NOT NULL,
	"help_banner_url" text,
	"footer_text" text DEFAULT '' NOT NULL,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_order_summary" boolean DEFAULT true NOT NULL,
	"show_address_editing" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence_step_id" uuid,
	"template_id" uuid,
	"to_email" text NOT NULL,
	"subject" text,
	"status" "email_send_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"qstash_message_id" text,
	"provider_message_id" text,
	"error" text,
	"triggered_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"trigger_type" "sequence_trigger_type" NOT NULL,
	"stage_id" uuid,
	"delay_days" integer,
	"position" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"preview_text" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"require_delivery_confirmation" boolean DEFAULT true NOT NULL,
	"notify_customer_on_fulfillment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"source" "stage_event_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"shopify_order_id" text NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"shipping_address" jsonb,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order_date" timestamp with time zone NOT NULL,
	"total" numeric(12, 2),
	"currency" text DEFAULT 'AUD' NOT NULL,
	"current_stage_id" uuid,
	"fulfillment_status" "fulfillment_status" DEFAULT 'unfulfilled' NOT NULL,
	"shopify_fulfillment_id" text,
	"fulfilled_at" timestamp with time zone,
	"fulfillment_error" text,
	"assigned_driver_name" text,
	"tracking_token" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_of_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"marked_delivered_by_user_id" uuid,
	"delivered_at" timestamp with time zone NOT NULL,
	"recipient_name" text,
	"paper_signature_photo_url" text,
	"driver_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"icon" text DEFAULT 'circle' NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"triggers_fulfillment" boolean DEFAULT false NOT NULL,
	"locks_address_editing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invite_token" text,
	"invite_expires_at" timestamp with time zone,
	"invited_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_domain" text NOT NULL,
	"primary_domain" text,
	"name" text,
	"currency" text DEFAULT 'AUD' NOT NULL,
	"access_token" text,
	"scope" text,
	"status" "store_status" DEFAULT 'active' NOT NULL,
	"installed_at" timestamp with time zone,
	"uninstalled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_event_id" text NOT NULL,
	"shop_domain" text,
	"topic" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "branding_settings" ADD CONSTRAINT "branding_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_sequence_step_id_email_sequence_steps_id_fk" FOREIGN KEY ("sequence_step_id") REFERENCES "public"."email_sequence_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_rules" ADD CONSTRAINT "fulfillment_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stage_history" ADD CONSTRAINT "order_stage_history_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_current_stage_id_stages_id_fk" FOREIGN KEY ("current_stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_marked_delivered_by_user_id_users_id_fk" FOREIGN KEY ("marked_delivered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branding_settings_store_key" ON "branding_settings" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "email_sends_due_idx" ON "email_sends" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "email_sends_order_idx" ON "email_sends" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "email_sends_store_idx" ON "email_sends" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_sends_order_step_key" ON "email_sends" USING btree ("order_id","sequence_step_id");--> statement-breakpoint
CREATE INDEX "email_sequence_steps_store_position_idx" ON "email_sequence_steps" USING btree ("store_id","position");--> statement-breakpoint
CREATE INDEX "email_sequence_steps_stage_idx" ON "email_sequence_steps" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "email_templates_store_idx" ON "email_templates" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_store_key_key" ON "email_templates" USING btree ("store_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_rules_store_key" ON "fulfillment_rules" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "order_stage_history_order_idx" ON "order_stage_history" USING btree ("order_id","occurred_at");--> statement-breakpoint
CREATE INDEX "order_stage_history_store_idx" ON "order_stage_history" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_store_shopify_order_key" ON "orders" USING btree ("store_id","shopify_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tracking_token_key" ON "orders" USING btree ("tracking_token");--> statement-breakpoint
CREATE INDEX "orders_store_created_idx" ON "orders" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_store_stage_idx" ON "orders" USING btree ("store_id","current_stage_id");--> statement-breakpoint
CREATE INDEX "orders_store_email_idx" ON "orders" USING btree ("store_id","customer_email");--> statement-breakpoint
CREATE INDEX "orders_store_number_idx" ON "orders" USING btree ("store_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_of_delivery_order_key" ON "proof_of_delivery" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "proof_of_delivery_store_idx" ON "proof_of_delivery" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_store_key_key" ON "stages" USING btree ("store_id","key");--> statement-breakpoint
CREATE INDEX "stages_store_position_idx" ON "stages" USING btree ("store_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "store_memberships_store_user_key" ON "store_memberships" USING btree ("store_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_memberships_invite_token_key" ON "store_memberships" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "store_memberships_user_idx" ON "store_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_shop_domain_key" ON "stores" USING btree ("shop_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events" USING btree ("shopify_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_topic_idx" ON "webhook_events" USING btree ("topic");