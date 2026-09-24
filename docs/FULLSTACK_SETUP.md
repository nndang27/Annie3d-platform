# Fullstack architecture and setup

Status: proposal and setup guide, 2026-09-24. Prices and limits were checked on the vendors'
pages or recent third-party summaries on this date; confirm on the vendor page before paying.

## 1. Architecture

```
Browser ──► Cloudflare (one domain)
            ├─ Static assets: Astro Home + Vite SPA (Workers Static Assets)
            ├─ API Worker (Hono): auth, boards, graph ops, credits, presigned uploads, share pages
            │    ├─ Hyperdrive ──► Neon Postgres (source of truth)
            │    ├─ R2 buckets: uploads (private), artifacts (private + public share copies)
            │    ├─ Durable Object per run: event stream to the browser (later: per-board room)
            │    ├─ Workflows: durable run orchestration (one step per node)
            │    ├─ Queues ──► compute workers
            │    ├─ Rate Limiting binding / KV: limits, cached config
            │    └─ AI Gateway ──► OpenAI / Anthropic (logging, caching, spend limits)
            └─ Compute (outside the Worker runtime)
                 ├─ Code builder: Python + CadQuery/Blender + LLM → Cloudflare Containers (CPU) or Modal
                 ├─ Generative builder: Tripo/Meshy/Hunyuan API, or Modal GPU
                 └─ Final render (path tracing), packaging, process reel → Modal GPU (scale to zero)
Payments: Paddle (merchant of record)   Errors: Sentry   Analytics/flags/A-B: PostHog
```

Why this shape:

- **One vendor for the edge** (hosting, storage, API, realtime, orchestration) keeps bills,
  secrets and latency simple for a small team; startup credits cover most of it.
- **Postgres stays the source of truth.** Everything else (KV, Durable Object state, R2) is
  either cache, stream or files.
- **Heavy compute is not on Workers.** Workers are for fast request handling; Blender,
  CadQuery and GPU rendering run in containers or GPU functions that scale to zero.

## 2. Service choices and comparison

### Hosting: Cloudflare Workers (static assets + API)

- Workers Paid: **$5/month** includes 10 M requests and 30 M CPU-ms; no egress charges.
- Alternatives: Vercel (best for Next.js, egress and function costs grow fast), Netlify,
  Fly.io (good for long-running servers), AWS (most control, most operations work).
- Fits our stack: static Astro + Vite SPA, API as a Worker, Durable Objects for realtime.
- **Cloudflare for Startups**: tiers reported at $5k (bootstrapped), $25k, $100k (seed), $250k
  (high growth) in credits, valid one year; requirements include a product website and
  company email. Apply once the domain and landing page exist.

### Database: Postgres on Neon, reached through Hyperdrive

- **Postgres is the right choice** in 2026: relational data (users, boards, nodes, runs,
  credits ledger, subscriptions) plus JSONB for node settings and pgvector later.
- **Neon**: serverless Postgres, scales to zero, database branches per preview/PR; free tier
  (0.5 GB per project), paid from about $19/month. Region: Singapore for Vietnam users.
- **Supabase**: Postgres + auth + storage + realtime; $25/month; compute runs 24/7. Good if we
  wanted its auth and storage; we use Better Auth and R2 instead.
- **PlanetScale Postgres**: no free tier, from about $39/month; stronger at large scale.
- **Hyperdrive** (included in Workers plans) pools connections at the edge; Cloudflare
  recommends Hyperdrive + `pg` (node-postgres); we add **Drizzle ORM** for schema and
  migrations. Use Neon's **direct (unpooled)** connection string with Hyperdrive.

### Object storage for video, GLB, images: Cloudflare R2

- $0.015/GB-month, **zero egress**, free 10 GB + 1 M writes + 10 M reads per month.
- Amazon S3 charges egress (the main cost for a product that serves videos and 3D files);
  R2 speaks the S3 API, so moving later is a copy job, not a rewrite.
- Buckets: `3dads-uploads` (user photos, private), `3dads-artifacts` (GLB, MP4, PNG, private),
  `3dads-public` (published share copies behind `cdn.<domain>` with long cache).
- Uploads: browser → **presigned multipart URL** from the API → R2 directly (no bytes through
  the Worker). Downloads: signed short-TTL URLs for private, CDN for public.

### Realtime and orchestration: Durable Objects, Workflows, Queues

- **Durable Object per run** holds the sequence-numbered event log and pushes events over
  WebSocket (with hibernation); the browser resumes from the last sequence after a reconnect.
  Later the same pattern becomes one room per board for multiplayer.
- **Workflows** (GA) run each node as a durable step with retries; per-step billing starts
  no earlier than 2026-08-10, so price it in phase 0.
- **Queues** hand work to compute and absorb bursts.

### Compute

- **Cloudflare Containers**: predefined instances up to 4 vCPU / 12 GiB; billed per 10 ms of
  running time. Good for the CPU code builder (CadQuery, headless Blender for previews).
- **Modal**: per-second GPU billing, scale to zero, fast cold starts; good for path-traced
  jewelry renders and self-hosted image-to-3D models. RunPod is cheaper only at high,
  steady utilisation.
- **Third-party 3D APIs** (Tripo, Meshy) for the generative builder at launch: no GPU to run.

### Cache and rate limiting: Redis is not needed at launch

- Rate limits: Workers Rate Limiting binding or a Durable Object counter (strongly consistent).
- Read-heavy config and share-page metadata: Workers KV (eventually consistent, up to 60 s).
- If Redis becomes necessary (leaderboards, complex counters, pub/sub): **Upstash Redis**.
  It works from Workers over HTTP; free 256 MB and 500 k commands/month, then $0.20 per
  100 k commands. A self-hosted Redis needs raw TCP, which Workers do not offer directly.

### Auth: Better Auth on the Worker

- Open source, stores users/sessions in our Postgres through Drizzle, Google sign-in and
  One Tap; runs on Workers with Hyperdrive. Alternative: Clerk (hosted, faster to add, paid
  per active user).

### Payments: Paddle (Stripe is not available to Vietnam-based companies)

- Stripe does not onboard Vietnam-based entities; the workaround is a foreign company.
- **Paddle** is a merchant of record (handles VAT/sales tax, invoices, refunds) and lists only
  sanctioned countries as unsupported; Vietnam is not on that list.
- **Polar** explicitly lists Vietnam as a supported seller country (payouts via Stripe
  Connect Express), aimed at developer and SaaS products.
- Start in Paddle sandbox; the credits ledger in Postgres stays the source of truth, payment
  webhooks only top it up (idempotent).

### Observability, product analytics, feature flags

- **Sentry** for errors (frontend + Worker), **PostHog** for product analytics, web-vitals RUM,
  feature flags and A/B tests, **Workers Logs** for request logs, **AI Gateway** for LLM usage.

### Try Cloudflare Quick Tunnel (`try.cloudflare.com`)

- `cloudflared tunnel --url http://localhost:4173` gives a random `*.trycloudflare.com` URL
  with no account. Good for showing the local build to a tester for an hour.
- Limits: testing only, no SLA, 200 in-flight requests (then HTTP 429), **no Server-Sent
  Events**, random URL each time. Not a host. For anything shared beyond a demo, deploy to
  Workers (free plan works) on our domain.

## 3. The production iceberg: what the MVP covers

| Area | MVP (public launch) | Later |
| --- | --- | --- |
| Authentication, access control | Google sign-in, sessions, per-board ownership, unlisted share tokens | Teams, roles, SSO |
| Payments, billing, subscription states | Paddle checkout + webhooks, credits ledger, one free run | Proration, invoices portal, coupons |
| CRUD, data integrity, idempotency | Drizzle schema + migrations, operation ids, transactional ledger | Audit log |
| Scalability, latency, load balancing | Edge hosting, CDN, Hyperdrive pooling, queues | Multi-region DB read replicas |
| Logging, alerting, incident response | Sentry alerts, Workers Logs, on-call = founders, status page | Paging rotation, runbooks |
| Disaster recovery, data retention | Neon point-in-time restore, R2 lifecycle rules, retention policy text | Cross-region backups |
| GDPR/CCPA, cookies | Privacy policy, data export/delete on request, cookie-less analytics mode | DPA templates |
| Rate limiting, abuse | Per-user and per-IP limits, free-run cap, upload validation | Fraud scoring |
| CI/CD, environments, rollbacks, feature flags | GitHub Actions: lint, types, tests, E2E, perf gate; preview per PR with a Neon branch; `wrangler rollback`; PostHog flags | Canary releases |
| Test coverage, instrumentation | Unit + E2E + perf budgets; RUM | Load tests |
| Conversion, retention, churn, A/B | PostHog funnels and cohorts; Sean Ellis survey | Lifecycle emails |
| Cloud costs | Cost per run tracked per step; budgets on AI Gateway and Modal | Reserved capacity |
| Secrets management | Wrangler secrets, GitHub secrets, `.dev.vars` locally (gitignored) | Rotation policy |
| Support ops, escalations | Feedback button + shared inbox | Help desk tool |
| Documentation, vendor lock-in | Docs in repo; S3-compatible storage, plain Postgres, Hono (portable) | — |

## 4. Setup you do manually (once)

Put every secret into `Production_system/3dads-platform/.dev.vars` (gitignored; template in
`.dev.vars.example`). **Do not paste secrets into chat.** I read them from that file and from
Wrangler.

1. **Cloudflare account**
   - Create an account (company email), then Workers & Pages → subscribe to **Workers Paid ($5)**.
   - Buy or move the domain to Cloudflare (Registrar sells at cost) and add it as a zone.
   - R2 → enable R2 (needs a payment method; free tier still applies).
   - R2 → Manage API tokens → create an **Object Read & Write** token limited to the 3dads
     buckets (create them first, or let me create them after step 2) → copy Access Key ID and
     Secret into `.dev.vars`.
   - Copy the Account ID into `.dev.vars`.
   - Later: apply to **Cloudflare for Startups** at cloudflare.com/startups.
2. **Let me drive Cloudflare from the terminal**: in the repo run `npx wrangler login` and
   approve in the browser. I then create buckets, Hyperdrive, Queues, Durable Objects and
   deploy with Wrangler.
3. **Neon**
   - Sign up, create project `3dads`, region **AWS Asia Pacific (Singapore)**, database
     `threedads`, Postgres 17.
   - Create a branch `dev`.
   - Copy the **direct** connection strings (turn "Connection pooling" off) for `main` and
     `dev` into `DATABASE_URL_PROD` and `DATABASE_URL_DEV`.
   - Optional for preview branches in CI: Account settings → API keys → create one for GitHub
     secrets (`NEON_API_KEY`).
4. **Google sign-in**
   - Google Cloud Console → new project → OAuth consent screen (External, app name 3Dads).
   - Credentials → OAuth client ID → Web application; authorised JavaScript origins
     `http://localhost:4173` and `https://<domain>`; redirect URI
     `https://<domain>/api/auth/callback/google` and the localhost equivalent.
   - Copy client ID and secret into `.dev.vars`; generate `BETTER_AUTH_SECRET` with
     `openssl rand -base64 32`.
5. **Payments**: create a **Paddle sandbox** account (or Polar), then create an API key and a
   webhook secret; put both in `.dev.vars`. Complete business verification before going live.
6. **Sentry** (project type: React + Cloudflare Workers) and **PostHog** (EU or US cloud): copy
   the DSN and project key.
7. **LLM keys**: create OpenAI/Anthropic keys with a monthly spend limit; I route them through
   an AI Gateway that I create with Wrangler.
8. **Later, when compute moves off your Mac**: create a **Modal** account and run
   `modal token new` in the terminal.
9. **GitHub Actions secrets** (repo Settings → Secrets): `CLOUDFLARE_API_TOKEN` (a custom
   token with Workers, R2, Hyperdrive, Queues and DNS edit on the 3dads zone),
   `CLOUDFLARE_ACCOUNT_ID`, `NEON_API_KEY`.
10. **Optional**: Upstash Redis database (region Singapore) → REST URL and token.

## 5. What I wire after that

- `apps/api` Worker (Hono) with Better Auth, Drizzle schema and migrations, R2 presigned
  multipart uploads, the run Durable Object, Workflows and Queues, rate limits.
- Swap the web app's mock transport for the live adapter behind the existing
  `PlatformServices` contract (`docs/HARNESS_INTEGRATION_CONTRACT.md`).
- `wrangler.toml` per environment (dev, preview, production), GitHub Actions pipeline with the
  perf gate, and a `pnpm deploy` script.
- Cost-per-run accounting per step, visible in the credits ledger.
