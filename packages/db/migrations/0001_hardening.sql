-- Hand-written hardening that the Drizzle schema builder cannot express.

-- 1. Fractional-index keys must compare byte-wise, not by the database locale
--    (rocicorp/fractional-indexing README: keys are ordered by code unit).
ALTER TABLE "board_nodes" ALTER COLUMN "z_key" TYPE text COLLATE "C";
--> statement-breakpoint

-- 2. updated_at maintained by the database, not trusted from clients.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','sessions','accounts','verifications','workspaces','assets','boards','board_nodes',
                           'credit_accounts','subscriptions','agent_threads','engine_jobs','reels']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t || '_set_updated_at', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- 3. The credit ledger is append-only: corrections are new 'adjust' entries.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'credit_entries is append-only (% blocked)', TG_OP USING ERRCODE = 'restrict_violation';
END $$;
--> statement-breakpoint
-- UPDATE is always blocked; DELETE only when the parent workspace still exists, so that
-- deleting a workspace still cascades.
CREATE TRIGGER credit_entries_no_update BEFORE UPDATE ON "credit_entries"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_ledger_delete_unless_cascade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM workspaces w WHERE w.id = OLD.workspace_id) THEN
    RAISE EXCEPTION 'credit_entries is append-only (DELETE blocked)' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER credit_entries_no_delete BEFORE DELETE ON "credit_entries"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_delete_unless_cascade();
--> statement-breakpoint

-- 4. A node's current version must belong to that node.
CREATE OR REPLACE FUNCTION check_current_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM node_versions v WHERE v.id = NEW.current_version_id AND v.node_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'current_version_id % does not belong to node %', NEW.current_version_id, NEW.id USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER board_nodes_current_version_chk BEFORE INSERT OR UPDATE OF current_version_id ON "board_nodes"
  FOR EACH ROW EXECUTE FUNCTION check_current_version();
