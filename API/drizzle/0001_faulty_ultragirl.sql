DROP INDEX "instances_clerk_id_idx";--> statement-breakpoint
DROP INDEX "active_instances_idx";--> statement-breakpoint
DROP INDEX "instance_key_hash_idx";--> statement-breakpoint
CREATE INDEX "keys_clerk_idx" ON "keys" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "keys_active_idx" ON "keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "keys_hash_idx" ON "keys" USING btree ("instance_key_hash");