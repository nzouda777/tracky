ALTER TABLE "stages" ADD COLUMN "advances_on_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Stores connected before this existed already have a "Confirmed" stage, and
-- it is the one that means "Shopify took the money". Naming it here spares
-- every existing store a trip through the stage editor to say so.
--
-- Scoped to the shipped key, and only when the store has not already named a
-- stage itself, so a shop that built its own ladder is left alone.
UPDATE "stages" SET "advances_on_payment" = true
WHERE "key" = 'confirmed'
  AND "store_id" NOT IN (
    SELECT DISTINCT "store_id" FROM "stages" WHERE "advances_on_payment" = true
  );
