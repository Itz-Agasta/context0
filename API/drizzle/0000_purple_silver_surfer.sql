CREATE TYPE "public"."subscription_plan" AS ENUM('basic', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"instance_key_hash" text NOT NULL,
	"arweave_wallet_address" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "keys_instance_key_hash_unique" UNIQUE("instance_key_hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"quota_limit" integer DEFAULT 1000 NOT NULL,
	"quota_used" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"renews_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"meta_mask_wallet_address" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_meta_mask_wallet_address_unique" UNIQUE("meta_mask_wallet_address")
);
--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_clerk_id_users_clerk_id_fk" FOREIGN KEY ("clerk_id") REFERENCES "public"."users"("clerk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clerk_id_users_clerk_id_fk" FOREIGN KEY ("clerk_id") REFERENCES "public"."users"("clerk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instances_clerk_id_idx" ON "keys" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "active_instances_idx" ON "keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "instance_key_hash_idx" ON "keys" USING btree ("instance_key_hash");--> statement-breakpoint
CREATE INDEX "subscription_clerk_id_idx" ON "subscriptions" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "active_subscriptions_idx" ON "subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "clerk_id_idx" ON "users" USING btree ("clerk_id");