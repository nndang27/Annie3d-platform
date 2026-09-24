CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_messages_role_chk" CHECK ("agent_messages"."role" IN ('user', 'assistant', 'tool')),
	CONSTRAINT "agent_messages_content_arr" CHECK (jsonb_typeof("agent_messages"."content") = 'array')
);
--> statement-breakpoint
CREATE TABLE "agent_threads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_variants" (
	"asset_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_variants_asset_id_variant_pk" PRIMARY KEY("asset_id","variant"),
	CONSTRAINT "asset_variants_storageKey_unique" UNIQUE("storage_key"),
	CONSTRAINT "asset_variants_variant_chk" CHECK ("asset_variants"."variant" ~ '^[a-z0-9_]{2,40}$'),
	CONSTRAINT "asset_variants_size_chk" CHECK ("asset_variants"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"triangle_count" integer,
	"original_filename" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_storageKey_unique" UNIQUE("storage_key"),
	CONSTRAINT "assets_kind_chk" CHECK ("assets"."kind" IN ('image', 'model3d', 'video', 'audio', 'text', 'file')),
	CONSTRAINT "assets_bucket_chk" CHECK ("assets"."bucket" IN ('uploads', 'artifacts', 'public')),
	CONSTRAINT "assets_status_chk" CHECK ("assets"."status" IN ('pending', 'ready', 'failed')),
	CONSTRAINT "assets_size_chk" CHECK ("assets"."byte_size" > 0),
	CONSTRAINT "assets_sha256_chk" CHECK ("assets"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "assets_meta_obj" CHECK (jsonb_typeof("assets"."meta") = 'object'),
	CONSTRAINT "assets_dims_chk" CHECK (("assets"."width" IS NULL OR "assets"."width" > 0) AND ("assets"."height" IS NULL OR "assets"."height" > 0))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_len" CHECK (length("users"."name") <= 200),
	CONSTRAINT "users_email_len" CHECK (length("users"."email") <= 254)
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_accounts_balance_chk" CHECK ("credit_accounts"."balance" >= 0 AND "credit_accounts"."reserved" >= 0 AND "credit_accounts"."reserved" <= "credit_accounts"."balance")
);
--> statement-breakpoint
CREATE TABLE "credit_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"run_id" uuid,
	"external_ref" text,
	"balance_after" bigint NOT NULL,
	"reserved_after" bigint NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_entries_reason_chk" CHECK ("credit_entries"."reason" IN ('grant_free', 'purchase', 'subscription', 'run_reserve', 'run_settle', 'run_refund', 'adjust')),
	CONSTRAINT "credit_entries_nonzero" CHECK ("credit_entries"."amount" <> 0 OR "credit_entries"."reason" IN ('run_reserve', 'run_settle', 'run_refund'))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "payment_events_provider_chk" CHECK ("payment_events"."provider" IN ('simulated', 'stripe', 'paddle'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_chk" CHECK ("subscriptions"."provider" IN ('simulated', 'stripe', 'paddle')),
	CONSTRAINT "subscriptions_plan_chk" CHECK ("subscriptions"."plan" IN ('creator', 'studio')),
	CONSTRAINT "subscriptions_status_chk" CHECK ("subscriptions"."status" IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete'))
);
--> statement-breakpoint
CREATE TABLE "board_edges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"source_port" text DEFAULT 'out' NOT NULL,
	"target_node_id" uuid NOT NULL,
	"target_port" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "board_edges_source_port_chk" CHECK ("board_edges"."source_port" = 'out'),
	CONSTRAINT "board_edges_target_port_chk" CHECK ("board_edges"."target_port" ~ '^[a-z][a-zA-Z0-9]{0,31}$'),
	CONSTRAINT "board_edges_no_self_loop" CHECK ("board_edges"."source_node_id" <> "board_edges"."target_node_id")
);
--> statement-breakpoint
CREATE TABLE "board_nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"label" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"z_key" text NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"current_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "board_nodes_kind_chk" CHECK ("board_nodes"."kind" IN ('photo', 'text', 'upload3d', 'audio', 'model3d', 'stage', 'packshot', 'adVideo', 'export', 'note')),
	CONSTRAINT "board_nodes_label_len" CHECK ("board_nodes"."label" IS NULL OR length("board_nodes"."label") <= 120),
	CONSTRAINT "board_nodes_settings_obj" CHECK (jsonb_typeof("board_nodes"."settings") = 'object'),
	CONSTRAINT "board_nodes_coords_chk" CHECK (abs("board_nodes"."x") <= 1e7 AND abs("board_nodes"."y") <= 1e7),
	CONSTRAINT "board_nodes_zkey_len" CHECK (length("board_nodes"."z_key") BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE TABLE "board_ops" (
	"board_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"op_id" uuid NOT NULL,
	"actor_id" uuid,
	"ops" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_ops_board_id_seq_pk" PRIMARY KEY("board_id","seq"),
	CONSTRAINT "board_ops_ops_array" CHECK (jsonb_typeof("board_ops"."ops") = 'array')
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"thumbnail_asset_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "boards_title_len" CHECK (length("boards"."title") BETWEEN 1 AND 120),
	CONSTRAINT "boards_seq_chk" CHECK ("boards"."seq" >= 0)
);
--> statement-breakpoint
CREATE TABLE "node_version_outputs" (
	"version_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "node_version_outputs_version_id_asset_id_pk" PRIMARY KEY("version_id","asset_id"),
	CONSTRAINT "node_version_outputs_role_chk" CHECK ("node_version_outputs"."role" IN ('primary', 'poster', 'turntable', 'packshot', 'report', 'extra'))
);
--> statement-breakpoint
CREATE TABLE "node_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"node_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"source" text NOT NULL,
	"run_id" uuid,
	"parent_version_id" uuid,
	"output_asset_id" uuid,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_hash" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_versions_no_chk" CHECK ("node_versions"."version_no" > 0),
	CONSTRAINT "node_versions_source_chk" CHECK ("node_versions"."source" IN ('run', 'edit', 'upload', 'agent')),
	CONSTRAINT "node_versions_params_obj" CHECK (jsonb_typeof("node_versions"."params") = 'object'),
	CONSTRAINT "node_versions_gates_arr" CHECK (jsonb_typeof("node_versions"."gates") = 'array'),
	CONSTRAINT "node_versions_hash_chk" CHECK ("node_versions"."input_hash" IS NULL OR "node_versions"."input_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "engine_jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"run_step_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"status" text DEFAULT 'dispatched' NOT NULL,
	"callback_secret_hash" text NOT NULL,
	"request" jsonb NOT NULL,
	"last_callback" jsonb,
	"deadline_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engine_jobs_status_chk" CHECK ("engine_jobs"."status" IN ('dispatched', 'running', 'succeeded', 'failed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "export_files" (
	"export_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "export_files_export_id_asset_id_pk" PRIMARY KEY("export_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"node_id" uuid,
	"version_id" uuid,
	"idempotency_key" uuid NOT NULL,
	"preset" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"report" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "exports_status_chk" CHECK ("exports"."status" IN ('queued', 'running', 'succeeded', 'failed')),
	CONSTRAINT "exports_preset_chk" CHECK ("exports"."preset" IS NULL OR "exports"."preset" IN ('web', 'google_merchant', 'google_swirl'))
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"run_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reels_mode_chk" CHECK ("reels"."mode" IN ('client', 'server')),
	CONSTRAINT "reels_status_chk" CHECK ("reels"."status" IN ('queued', 'rendering', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "result_cache" (
	"workspace_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"node_kind" text NOT NULL,
	"engine_version" text NOT NULL,
	"version_id" uuid NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hit_at" timestamp with time zone,
	CONSTRAINT "result_cache_workspace_id_input_hash_pk" PRIMARY KEY("workspace_id","input_hash"),
	CONSTRAINT "result_cache_hash_chk" CHECK ("result_cache"."input_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" uuid,
	"seq" smallint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"input_hash" text,
	"output_version_id" uuid,
	"error_code" text,
	"error_message" text,
	"gate" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "run_steps_status_chk" CHECK ("run_steps"."status" IN ('pending', 'running', 'succeeded', 'failed', 'skipped', 'cached')),
	CONSTRAINT "run_steps_credits_chk" CHECK ("run_steps"."credits" >= 0),
	CONSTRAINT "run_steps_msg_len" CHECK ("run_steps"."error_message" IS NULL OR length("run_steps"."error_message") <= 500),
	CONSTRAINT "run_steps_hash_chk" CHECK ("run_steps"."input_hash" IS NULL OR "run_steps"."input_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by" uuid,
	"kind" text DEFAULT 'graph' NOT NULL,
	"scope" text NOT NULL,
	"root_node_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"estimated_credits" integer NOT NULL,
	"charged_credits" integer DEFAULT 0 NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"used_free_run" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"last_event_seq" integer DEFAULT 0 NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_kind_chk" CHECK ("runs"."kind" IN ('graph', 'edit', 'export', 'agent')),
	CONSTRAINT "runs_scope_chk" CHECK ("runs"."scope" IN ('node', 'from_here', 'with_upstream', 'all')),
	CONSTRAINT "runs_status_chk" CHECK ("runs"."status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'partial')),
	CONSTRAINT "runs_credits_chk" CHECK ("runs"."estimated_credits" >= 0 AND "runs"."charged_credits" >= 0),
	CONSTRAINT "runs_params_obj" CHECK (jsonb_typeof("runs"."params") = 'object'),
	CONSTRAINT "runs_finish_chk" CHECK ("runs"."finished_at" IS NULL OR "runs"."finished_at" >= "runs"."created_at")
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"token" text NOT NULL,
	"visibility" text DEFAULT 'unlisted' NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "shares_token_unique" UNIQUE("token"),
	CONSTRAINT "shares_target_chk" CHECK ("shares"."target_type" IN ('version', 'board')),
	CONSTRAINT "shares_visibility_chk" CHECK ("shares"."visibility" IN ('public', 'unlisted')),
	CONSTRAINT "shares_token_chk" CHECK ("shares"."token" ~ '^[A-Za-z0-9_-]{22,64}$')
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "workspace_members_role_chk" CHECK ("workspace_members"."role" IN ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"free_run_used_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_plan_chk" CHECK ("workspaces"."plan" IN ('free', 'creator', 'studio')),
	CONSTRAINT "workspaces_name_len" CHECK (length("workspaces"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_variants" ADD CONSTRAINT "asset_variants_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edges" ADD CONSTRAINT "board_edges_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edges" ADD CONSTRAINT "board_edges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edges" ADD CONSTRAINT "board_edges_source_node_id_board_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."board_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_edges" ADD CONSTRAINT "board_edges_target_node_id_board_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."board_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_nodes" ADD CONSTRAINT "board_nodes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_nodes" ADD CONSTRAINT "board_nodes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_nodes" ADD CONSTRAINT "board_nodes_current_version_id_node_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."node_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_nodes" ADD CONSTRAINT "board_nodes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ops" ADD CONSTRAINT "board_ops_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ops" ADD CONSTRAINT "board_ops_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_thumbnail_asset_id_assets_id_fk" FOREIGN KEY ("thumbnail_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_version_outputs" ADD CONSTRAINT "node_version_outputs_version_id_node_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."node_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_version_outputs" ADD CONSTRAINT "node_version_outputs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_node_id_board_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."board_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_parent_version_id_node_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."node_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_output_asset_id_assets_id_fk" FOREIGN KEY ("output_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_versions" ADD CONSTRAINT "node_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_jobs" ADD CONSTRAINT "engine_jobs_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_export_id_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_node_id_board_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."board_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_version_id_node_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."node_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_cache" ADD CONSTRAINT "result_cache_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_cache" ADD CONSTRAINT "result_cache_version_id_node_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."node_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_node_id_board_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."board_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_output_version_id_node_versions_id_fk" FOREIGN KEY ("output_version_id") REFERENCES "public"."node_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_messages_thread_idx" ON "agent_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_threads_board_idx" ON "agent_threads" USING btree ("board_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_threads_workspace_idx" ON "agent_threads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_threads_created_by_idx" ON "agent_threads" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_dedupe_uq" ON "assets" USING btree ("workspace_id","sha256","kind") WHERE "assets"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "assets_workspace_created_idx" ON "assets" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assets_created_by_idx" ON "assets" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_uq" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_external_ref_uq" ON "credit_entries" USING btree ("external_ref") WHERE "credit_entries"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_entries_workspace_recent_idx" ON "credit_entries" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "credit_entries_run_idx" ON "credit_entries" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "credit_entries_created_by_idx" ON "credit_entries" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_uq" ON "payment_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_sub_uq" ON "subscriptions" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_workspace_idx" ON "subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_edges_live_uq" ON "board_edges" USING btree ("source_node_id","target_node_id","target_port") WHERE "board_edges"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "board_edges_board_live_idx" ON "board_edges" USING btree ("board_id") WHERE "board_edges"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "board_edges_target_idx" ON "board_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "board_edges_workspace_idx" ON "board_edges" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "board_nodes_board_live_idx" ON "board_nodes" USING btree ("board_id") WHERE "board_nodes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "board_nodes_workspace_idx" ON "board_nodes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "board_nodes_current_version_idx" ON "board_nodes" USING btree ("current_version_id");--> statement-breakpoint
CREATE INDEX "board_nodes_created_by_idx" ON "board_nodes" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "board_ops_op_id_uq" ON "board_ops" USING btree ("board_id","op_id");--> statement-breakpoint
CREATE INDEX "board_ops_actor_idx" ON "board_ops" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "boards_workspace_recent_idx" ON "boards" USING btree ("workspace_id","updated_at" DESC NULLS LAST) WHERE "boards"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "boards_thumbnail_idx" ON "boards" USING btree ("thumbnail_asset_id");--> statement-breakpoint
CREATE INDEX "boards_created_by_idx" ON "boards" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "node_version_outputs_asset_idx" ON "node_version_outputs" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "node_versions_node_no_uq" ON "node_versions" USING btree ("node_id","version_no");--> statement-breakpoint
CREATE INDEX "node_versions_board_idx" ON "node_versions" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "node_versions_workspace_idx" ON "node_versions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "node_versions_run_idx" ON "node_versions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "node_versions_parent_idx" ON "node_versions" USING btree ("parent_version_id");--> statement-breakpoint
CREATE INDEX "node_versions_output_asset_idx" ON "node_versions" USING btree ("output_asset_id");--> statement-breakpoint
CREATE INDEX "node_versions_created_by_idx" ON "node_versions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "engine_jobs_step_idx" ON "engine_jobs" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "engine_jobs_open_idx" ON "engine_jobs" USING btree ("deadline_at") WHERE "engine_jobs"."status" IN ('dispatched', 'running');--> statement-breakpoint
CREATE INDEX "export_files_asset_idx" ON "export_files" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exports_idempotency_uq" ON "exports" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "exports_board_idx" ON "exports" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "exports_node_idx" ON "exports" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "exports_version_idx" ON "exports" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "exports_created_by_idx" ON "exports" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "reels_run_idx" ON "reels" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "reels_workspace_idx" ON "reels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "reels_asset_idx" ON "reels" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "result_cache_version_idx" ON "result_cache" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_seq_uq" ON "run_steps" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "run_steps_node_idx" ON "run_steps" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "run_steps_output_version_idx" ON "run_steps" USING btree ("output_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_idempotency_uq" ON "runs" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "runs_board_recent_idx" ON "runs" USING btree ("board_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "runs_active_idx" ON "runs" USING btree ("workspace_id","status") WHERE "runs"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "runs_requested_by_idx" ON "runs" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "shares_board_idx" ON "shares" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "shares_workspace_idx" ON "shares" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "shares_created_by_idx" ON "shares" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_created_by_idx" ON "workspaces" USING btree ("created_by");