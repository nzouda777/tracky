ALTER TABLE "branding_settings" ALTER COLUMN "heading_font_size" SET DEFAULT 42;--> statement-breakpoint
ALTER TABLE "branding_settings" ALTER COLUMN "section_background" SET DEFAULT '#F4F5F3';--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "form_prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "form_placeholder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "form_button_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "show_form_icon" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "branding_settings" ADD COLUMN "show_button_arrow" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Bring stores that never chose otherwise onto the new default look.
--
-- `SET DEFAULT` above only governs rows inserted from now on, so without this
-- every store connected before today keeps the old small heading and no band —
-- which is exactly the shape of "I changed the default and nothing happened".
--
-- The predicate is the old shipped default, so a store that deliberately typed
-- 26 is swept along with one that never opened the panel. There is no column
-- recording the difference, and with the product this young the wrong call is
-- leaving a shop on a layout nobody chose. Either is one edit to undo.
UPDATE "branding_settings" SET "heading_font_size" = 42 WHERE "heading_font_size" = 26;--> statement-breakpoint
UPDATE "branding_settings" SET "section_background" = '#F4F5F3' WHERE "section_background" IS NULL;
