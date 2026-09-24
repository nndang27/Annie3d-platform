ALTER TABLE "asset_variants" DROP CONSTRAINT "asset_variants_storageKey_unique";--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_storageKey_unique";--> statement-breakpoint
CREATE INDEX "asset_variants_storage_key_idx" ON "asset_variants" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_storage_key_uq" ON "assets" USING btree ("storage_key") WHERE "assets"."bucket" <> 'public';