ALTER TABLE "fulfillment_rules" ALTER COLUMN "notify_customer_on_fulfillment" SET DEFAULT true;--> statement-breakpoint
-- Existing stores get "now" as their start date: every order already in the
-- system stays manual, only orders placed from here on are auto-fulfilled.
ALTER TABLE "fulfillment_rules" ADD COLUMN "auto_fulfill_since" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Auto-fulfilled orders now carry Shopify's shipping email as well as the
-- app's own stage emails. Safe because older orders never get it.
UPDATE "fulfillment_rules" SET "notify_customer_on_fulfillment" = true;
