# CI/CD setup (do this after the canvas website is coded)

Status: guide, 2026-09-24. Nothing here is active yet. The workflow template lives in
`ci/templates/ci.yml` and is copied into `.github/workflows/` at step 4.

Split of responsibilities:

- **GitHub Actions** runs the checks: lint, typecheck, unit tests, build, Playwright on three
  engines, the performance gate. Nothing merges to `main` unless they pass.
- **Cloudflare Workers Builds** builds and deploys: a Preview per branch/pull request, and
  production on every merge to `main`.
- **Neon** gives every pull request its own database branch.

```
feature branch ──push──► GitHub Actions checks ─┐
                └──────► Workers Builds preview ─┴─► review ──merge──► main
main ──► Actions checks ──► Workers Builds production deploy ──► Sentry watch ──► rollback if needed
```

## 0. Before you start

- Repository visibility: **`nndang27/Annie3d-platform` is currently PUBLIC.** Code, strategy
  and fundraising docs are readable by anyone. For a startup product, switch it to private
  (GitHub → Settings → General → Danger Zone → Change visibility) unless open source is
  intended. Private repos on GitHub Free get 2,000 Actions minutes/month; the full matrix
  uses roughly 25–35 minutes per pull request, so upgrade to GitHub Team if the team opens
  more than ~60 pull requests a month.
- Wrangler ≥ 4.135 in the repo (Workers Previews needs it).
- The API Worker, `wrangler.jsonc` and Drizzle migrations exist (built with the canvas).

## 1. Protect `main` on GitHub

1. Repo → **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. Name `main`, **Enforcement status: Active**, **Target branches: Include default branch**.
3. Enable:
   - **Restrict deletions**, **Block force pushes**.
   - **Require a pull request before merging** (1 approval once there are two engineers;
     0 while solo).
   - **Require status checks to pass** → add `checks`, every `e2e (…)` job and `perf`
     (they appear after the first workflow run) → tick **Require branches to be up to date**.
4. Save.

## 2. GitHub secrets and variables

Repo → **Settings → Secrets and variables → Actions**:

| Name | Kind | Where it comes from |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | Cloudflare → Manage account → Account API tokens → Create → **Edit Cloudflare Workers** template, plus Workers R2 Storage Edit, Hyperdrive Edit, Queues Edit, Workers KV Edit; account = the Annie 3D account only |
| `CLOUDFLARE_ACCOUNT_ID` | variable | `e8d27f99b43abe6c81feb5bf0b1ea714` |
| `NEON_API_KEY` | secret | Neon → Account settings → API keys |
| `NEON_PROJECT_ID` | variable | Neon → project Settings |
| `SENTRY_AUTH_TOKEN` | secret | Sentry → Settings → Auth tokens (for source-map upload and release tracking) |

Never paste these values into chat or commit them.

## 3. Connect Workers Builds (deploy + previews)

For each Worker (the web/API Worker first):

1. Cloudflare → **Compute → Workers & Pages** → open the Worker (or **Create application →
   Import a repository** for a new one) → **Settings → Build**.
2. **Git repository → Connect** → authorise the Cloudflare GitHub app for
   `nndang27/Annie3d-platform` only.
3. Build settings:
   - **Production branch**: `main`.
   - **Root directory**: `/` (monorepo root).
   - **Build command**: `pnpm install --frozen-lockfile && pnpm build`.
   - **Deploy command**: `npx wrangler deploy`.
   - **Non-production branch builds: Enabled** → preview command
     `npx wrangler versions upload` (Previews) per the Workers Previews guide.
   - **Build watch paths**: `apps/**`, `packages/**`, `pnpm-lock.yaml`, `wrangler.jsonc`.
   - **Build variables**: `NODE_VERSION=24`, `PNPM_VERSION=10.28.2`.
4. Save. The next push builds; a pull request receives a comment with its Preview URL.
5. Preview URLs are **public**. Protect them with Cloudflare Access (Zero Trust → Access →
   Applications → Self-hosted → the preview hostname → allow the team's emails) before
   sharing unreleased features.

Limits: Free plan 3,000 build minutes/month and 1 concurrent build; Paid 6,000 minutes then
$0.005/min and 6 concurrent; 20-minute timeout per build.

## 4. Turn on GitHub Actions checks

1. Add the performance baseline once on a good build: `pnpm perf` then commit
   `perf-results/baseline.json` (script `perf:gate` compares against it; added with the canvas).
2. Copy the template: `mkdir -p .github/workflows && cp ci/templates/ci.yml .github/workflows/ci.yml`.
3. Commit on a branch, open a pull request, watch the run under **Actions**.
4. After the first green run, go back to step 1.3 and select the status checks.

## 5. A database branch per pull request (Neon)

Add a second workflow (`.github/workflows/preview-db.yml`) when the API uses Postgres:

- On `pull_request` opened/synchronised: `neondatabase/create-branch-action` (branch name
  `preview/pr-<number>`, parent `dev`) → run `pnpm db:migrate` against it → pass its
  connection string to the Preview as a secret (`wrangler versions secret put` in the
  preview flow).
- On `pull_request` closed: `neondatabase/delete-branch-action`.
- Production migrations run in the production deploy job **before** `wrangler deploy`,
  and must be backward compatible with the currently deployed code (expand → migrate →
  contract), because a code rollback does not roll back the schema.

Check the current major versions of the Neon actions on the GitHub Marketplace when adding
them.

## 6. Everyday flow for the team

1. `git switch -c feat/<name>` → code → `pnpm lint && pnpm typecheck && pnpm test` locally.
2. Push → open a pull request. Actions runs checks; Workers Builds posts the Preview URL;
   Neon creates `preview/pr-<n>`.
3. Review on the Preview URL (Access-protected).
4. Merge when all checks are green → production build and deploy start automatically.
5. Watch Sentry and Workers Observability for 15 minutes after each deploy.

## 7. Rollback

- Code: Cloudflare dashboard → Worker → **Deployments** → pick the previous version →
  **Rollback**, or `npx wrangler rollback [version-id]`.
- Data: not rolled back. Fix forward with a new migration, or restore the Neon branch to a
  point in time (Neon → Branches → Restore) if data was damaged.
- Secrets: `wrangler secret put` deploys immediately; use `wrangler versions secret put`
  when the change must ship with a specific version.

## 8. Later

- Gradual deployments (percentage rollout) once there is real traffic.
- A staging Worker (`--env staging`) if a long-lived pre-production environment is needed.
- Nightly job: full E2E against production with a synthetic account.
