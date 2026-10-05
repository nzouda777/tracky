ALTER TABLE "stages" ADD COLUMN "phase" text DEFAULT 'processing' NOT NULL;--> statement-breakpoint
UPDATE "stages" SET "phase" = 'delivered' WHERE "is_terminal" = true;--> statement-breakpoint
UPDATE "stages" SET "phase" = 'placed' WHERE "key" = 'order-placed';--> statement-breakpoint
UPDATE "stages" SET "phase" = 'transit' WHERE ("key" = 'out-for-delivery' OR "locks_address_editing" = true) AND "is_terminal" = false;
