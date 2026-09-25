-- Earlier concurrent share requests could leave several live links for one target. Keep the
-- newest live link per target and revoke the rest, so the unique index below can be built.
UPDATE "shares" s SET "revoked_at" = now()
WHERE s."revoked_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "shares" n
    WHERE n."workspace_id" = s."workspace_id" AND n."target_id" = s."target_id"
      AND n."revoked_at" IS NULL
      AND (n."created_at", n."id") > (s."created_at", s."id")
  );--> statement-breakpoint
CREATE UNIQUE INDEX "shares_live_target_uq" ON "shares" USING btree ("workspace_id","target_id") WHERE "shares"."revoked_at" IS NULL;