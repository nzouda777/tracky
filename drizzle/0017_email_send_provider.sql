ALTER TABLE "email_sends" ADD COLUMN "provider" text;--> statement-breakpoint
-- Every send accepted before this column existed went through Resend.
UPDATE "email_sends" SET "provider" = 'resend' WHERE "status" = 'sent';