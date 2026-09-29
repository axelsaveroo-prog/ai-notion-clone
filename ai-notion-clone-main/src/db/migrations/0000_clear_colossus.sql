CREATE TYPE "public"."room_role_enum" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(765),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users_to_documents" (
	"user_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"role" "room_role_enum" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_to_documents_user_id_document_id_pk" PRIMARY KEY("user_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(320)
);
--> statement-breakpoint
ALTER TABLE "users_to_documents" ADD CONSTRAINT "users_to_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_documents" ADD CONSTRAINT "document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;