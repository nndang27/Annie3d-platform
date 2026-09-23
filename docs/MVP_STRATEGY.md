# 3Dads MVP strategy

Status: consolidated decision record, 2026-09-24. Supersedes the scope parts of
`WORKFLOW_3D_DESIGN.md` and refines `MVP_VERTICAL_WORKFLOWS.md` (which keeps the
per-line node detail). Items marked **Decision needed** are open for the founder.

## 1. Strategy in one paragraph

3Dads is a **3D advertising workspace**: open the site, you are on a canvas; drop one product
photo, pick a production line, and an agent team builds the product in 3D and delivers a
finished ad video, an animated `.glb` and packshots, with a share link anyone can open.
Canva gives templates you fill by hand; 3Dads gives production lines that run themselves.
We launch narrow (three verticals, three lines, 3D only), measure quality with fixed eval
sets, and grow through the share links the outputs create.

## 2. Who it is for at launch

- **Primary**: online sellers and small brands in consumer electronics and gadgets,
  jewelry and watches, beauty/skincare/fragrance, plus the freelancers and small
  agencies who make ads for them.
- **Job to be done**: "I need a premium-looking product ad and a 3D asset this week,
  without a CGI studio or 3D skills."
- **Not at launch**: mechanical engineers (technical drawings), enterprise brands with
  CAD pipelines, furniture/food/apparel sellers.

## 3. Agent architecture (existing systems, no new agents)

| System | Role in the MVP |
| --- | --- |
| Code builder | Primary builder for all three verticals: parts + assembly from one photo. |
| Generative builder | Fallback when the code builder fails its gate; jewelry filigree; text-to-3D for organic props. |
| Scene director | Materials, environment from the line's asset kit, placement, camera, motion, render. |

Shared backbone per run: Intake → Router → Builder → Twin check → Materials → Rig → Scene →
Motion → Render → Package. Details per line: `MVP_VERTICAL_WORKFLOWS.md`.

## 4. Feature set

### In the public launch

| # | Feature | Launch scope |
| --- | --- | --- |
| F1 | **Canvas-first site** | `/` opens the canvas with a finished example line already run. A static Home/landing page exists for SEO and ads. Phones get the same canvas, scaled; drag to pan, pinch to zoom; one-finger drag inside a 3D node orbits the model. |
| F2 | **Image-to-3D** | One photo in, 3D model with named parts out, via the Router. |
| F3 | **Text-to-3D** | For props and scene elements, and for products when no photo exists (labelled as concept). |
| F4 | **3D-to-image** | Packshots at any angle the user frames, plus four automatic angles. |
| F5 | **3D-to-video** | The three production lines: Teardown reveal (electronics), Stone & water (jewelry), Splash hero (beauty). Outputs MP4 in 1:1, 4:5, 9:16. |
| F6 | **Animated `.glb` export** | The line's motion baked into the GLB; presets: Web/Shopify, Google Merchant (≤ 15 MB), Google Swirl (≤ 3 MB, ≤ 40k polygons), each with pass/fail validation. |
| F7 | **Agent prompt bar** | One chat surface at the bottom of the canvas that creates and edits nodes; no separate chat mode. |
| F8 | **Region-select + chat edit** | Brush or lasso on the 3D model, then describe the change. Code-built models: colour, material, logo/label, part scale/move, shape features. Generative models: colour, material, logo/label only until a 20-case test passes. No manual mesh tools anywhere. |
| F9 | **Versions** | Every run and edit is a version on its node, with before/after compare and one-click revert. |
| F10 | **Cloud share link** | Public or unlisted link opening a viewer with the model orbiting in about a second, download button, embed code, and a "Make your own" call to action. Rich previews (image + short video) for Facebook, Telegram, X, Zalo, Messenger. |
| F11 | **Accounts and billing** | Everything on the example project works without an account. One-tap Google sign-in at the first run on the user's own photo; one full run free; further runs need a subscription. Credit cost shown before Run. |

### Toolbar (bottom of the canvas)

Left group: Select, Pan, Comment. Right group: Photo, Text, 3D, Packshot, Video, Upload.
The region brush appears only when a 3D node is focused.

### Out of the launch (and when to reconsider)

| Out | Reconsider when |
| --- | --- |
| 3D-to-sketch2D technical drawings | v1.1, when the CAD pipeline passes its own eval set; opens the engineering segment. |
| AI video (Seedance-style), TTS, AI music, image generation nodes | After the 3D lines hit their retention target. |
| Furniture, food, apparel, toys lines | After the three launch lines pass their eval bars; furniture first. |
| Video → interactive 3D reveal, website 3D widget | After share-link data shows embed demand. |
| Channel-specific ad variants, review/approval, teams, multiplayer, freehand drawing, notifications | When paying customers ask for them. |

**Decision needed**: licensed music beds at launch, or silent video first.

## 5. Quality bar

- Eval set: 30 real retailer photos per line (90 total).
- A line ships publicly when ≥ 24/30 runs pass all automatic gates with no human edit,
  and two outside reviewers rate ≥ 20 of those 24 "would post this ad".
- Every model, prompt or asset-kit change re-runs the eval set; a drop blocks release.
- A production run that fails its gates stops, refunds the credit and tells the user which
  gate failed.

## 6. Launch plan

| Phase | Weeks (estimate) | What happens | Exit gate |
| --- | --- | --- | --- |
| 0. Riskiest-assumption test | 1–2 | Run 20 real products per vertical through the lines, fixing by hand where needed (Wizard of Oz). 15 seller interviews using The Mom Test. | Sellers would pay for at least one line; we know the failure modes. |
| 1. Private alpha | 3–6 | 20–30 hand-picked sellers and agencies, free, runs watched by us. Share links on. | Eval bar met on ≥ 2 lines; ≥ 10 alpha users post a 3Dads ad publicly. |
| 2. Closed beta | 7–10 | Waitlist in waves (100 → 500 → 2 000), paid plan live, daily cap on free runs. | Free→paid conversion and week-4 retention measured; GPU cost per run below price/3. |
| 3. Public launch | 11+ | Product Hunt, Show HN, X, TikTok and Reddit demo clips, Vietnamese seller communities, launch week with one new line per day. | Sean Ellis survey ≥ 40 % "very disappointed" among weekly users before paid growth. |

Why waves and not an open door on day one: every free run costs real GPU time, and misuse
arrives with attention (section 9). Waves keep quality visible and the bill bounded.

## 7. Metrics

| Metric | Why |
| --- | --- |
| Time from landing to first 3D view | The wow moment; target under one minute on the example, under ten on the user's photo. |
| Run success rate in production | Must track the eval pass rate; a gap means the eval set is unrepresentative. |
| Share rate (runs whose link is opened by someone else) | The growth engine. |
| Signups per 100 share-link views | Viral loop strength. |
| Free→paid conversion after the free run | Pricing and value check. |
| Week-4 retention of paying users | Whether this is a habit or a one-off. |
| Gross margin per run | GPU + LLM + render cost vs price. |

## 8. Fundraising path

- **Now → alpha evidence**: a pre-seed is raised on team, demo and signal, not on user
  counts (ElevenLabs raised $2M before its public beta; Lovable raised $7.5M on GitHub stars
  and a waitlist before its public product launch). Our signal: the demo video of a line,
  eval pass rates, waitlist size, alpha users posting 3Dads ads.
- **Where**: accelerators with standard terms (YC $500k; a16z speedrun up to $1M; Antler
  ~$100–250k depending on region) or pre-seed funds that back AI/creative tools
  (Credo Ventures and Concept Ventures backed ElevenLabs at pre-seed).
- **Seed / Series A**: after public launch, on revenue and retention. Reference points:
  ElevenLabs Series A ($19M) five months after beta with 1M+ registered users; Lovable
  $15M Series A three months after launch at ~$17M ARR; Cursor $8M seed seven months after
  launch. These are outliers, not thresholds.
- **Alternative**: Midjourney never took VC and was profitable within weeks. If gross margin
  per run is healthy after beta, bootstrapping longer is a real option.

**Decision needed**: apply to an accelerator during the private alpha, or wait for public
launch numbers.

## 9. Lessons from early-stage AI startups (sources in the chat record)

| Company | First wow feature | How first users came | Controlled or open | Money |
| --- | --- | --- | --- | --- |
| ElevenLabs | Text-to-speech + instant voice cloning that fooled people | Public beta Jan 2023; memes on 4chan/YouTube; "a few thousand on the beta list turns into hundreds of thousands" | Open beta; misuse within days forced traceability, a verification tool and paid, card-verified cloning | $2M pre-seed before beta; $19M Series A Jun 2023 at 1M+ users |
| Lovable | "Describe an app, get a working app" | Weekend open-source GPT Engineer (Jun 2023), one tweet, 52k GitHub stars, 27k waitlist; a year building the web product; #1 Product Hunt and HN at launch (Nov 2024); users sharing before/after clips; team posting builds | Waitlist to control onboarding and collect feedback, then public | $7.5M pre-seed Oct 2024; $15M Series A Feb 2025 |
| Midjourney | Striking images from a sentence | Discord beta Feb 2022, public Jul 2022; every image generated in public channels | Invite waves, then public | No VC; profitable with ~10 people in Aug 2022 |
| Krea | Real-time AI image generation | 200k waitlist, 10k beta testers | Waitlist and invites | Venture-backed later |
| Cursor | AI built into a familiar editor | Developers switching editors, word of mouth | Public launch Mar 2023 | $8M seed Oct 2023 (7 months later) |

Patterns that apply to us:

1. **The output is the marketing.** Midjourney's public channels, ElevenLabs' memes and
   Lovable's before/after clips all spread because the result was shareable. Our share
   link and the ad itself must carry "Made with 3Dads".
2. **Launch early to a few, go wide when the loop is reliable.** Everyone shipped early
   to controlled groups; wide attention before guardrails cost ElevenLabs its first
   crisis week.
3. **Attention can be built before the product.** Lovable's open-source demo created the
   waitlist a year before launch. Our equivalent: post the three line demos and collect a
   waitlist during the alpha.
4. **Guardrails ship with the viral feature.** For us: brand/IP misuse (counterfeit
   product ads), and free-run abuse against GPU cost.

## 10. Decisions needed (summary)

1. Music beds at launch or silent video.
2. Accelerator application timing.
3. Subscription price, set only after measuring cost per run in phase 0 (price ≥ 3 × cost).
4. Render: own GPU or render service for path-traced frames (jewelry).
