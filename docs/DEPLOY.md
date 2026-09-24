# Deploy runbook (production)

Production is `https://annie3d.nndang2701.workers.dev`: one Worker (SPA + API + Durable Objects),
Neon `production` branch (Sydney) through Hyperdrive `annie3d-prod`, and R2 buckets in OC.

## Deploy a new version
```bash
pnpm check          # typecheck, lint, unit tests, build
pnpm test:api       # live API tests on a disposable Neon branch
pnpm test:e2e       # Chromium, WebKit and Firefox on a disposable branch
pnpm run deploy:prod  # CLOUDFLARE_ENV=production build + wrangler deploy (not `pnpm deploy`: that is a pnpm built-in)
```
- `CLOUDFLARE_ENV=production` selects `env.production` in `apps/web/wrangler.jsonc` at build time
  (Cloudflare Vite plugin). Deploying a non-production build would ship dev variables.
- Schema changes: run migrations on the production branch before deploying code that needs them.
  `packages/db/src/scripts/migrate.ts` with `MIGRATE_URL` set to the direct production URL.
- Rollback: `pnpm --filter @annie3d/web exec wrangler rollback` (code only; data is not rolled back).

## Share a local build without deploying (review links)
```bash
pnpm share          # build + vite preview :4173 + Cloudflare quick tunnel; prints https://<random>.trycloudflare.com
pnpm share --no-build
pnpm share:stop
```
- Uses the development config and the dev Neon branch; production is untouched. Migration 0003
  (`copy` version source) is applied on dev only until the next production deploy.
- The tunnel URL stays the same across `pnpm share` runs while the tunnel process lives
  (`.share/tunnel.pid`); it changes after `pnpm share:stop` or a reboot.
- Google sign-in on the link needs `<link>/api/auth/callback/google` in the OAuth client's
  redirect URIs and `<link>` in its JavaScript origins. Signed-in uploads need `<link>` in the
  R2 CORS rules (`infra/r2-cors.json`). Guests work without either.

## One-time setup (done on 2026-09-24)
| Item | Value / how |
| --- | --- |
| Hyperdrive | `annie3d-prod` → Neon production (direct URL, channel_binding removed); id in wrangler.jsonc |
| Secrets | `wrangler secret bulk --name annie3d` from stdin: BETTER_AUTH_SECRET (fresh, prod only), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY |
| Never in production | `ANNIE3D_TEST_AUTH` (email/password test sign-in) |
| R2 CORS | `infra/r2-cors.json` on `annie3d-uploads` (includes the workers.dev origin) |
| Fixtures | `annie3d-public/fixtures/v1/*` (`node fixtures/upload.mjs`) |

## Still needed from the owner
- Google Cloud Console → OAuth client:
  - Authorised redirect URI `https://annie3d.nndang2701.workers.dev/api/auth/callback/google`.
  - Authorised JavaScript origin `https://annie3d.nndang2701.workers.dev` (for One Tap).
- Real payment provider (Stripe/Paddle) replacing `/billing/checkout` + `/api/billing/simulated/*`.
- Optional custom domain: add it in Cloudflare, then update `APP_URL`, the R2 CORS origins and
  the Google OAuth URIs.
- CI/CD: `docs/CICD_SETUP.md` and `ci/templates/ci.yml` (not active yet).
