ALTER TABLE "documents" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_documents" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;