# Routes and interaction coverage matrix

Every shipped control maps to an observable outcome and the test that asserts it. "E2E" refers to `tests/e2e/*.spec.ts` run against the production preview; "unit" to `vitest`. Status is filled from the last recorded run (see docs/QA_REPORT.md).

## Public site (Astro, `apps/marketing`)

| Route | Controls | Expected behaviour | Verified by |
| --- | --- | --- | --- |
| `/` | Header nav (5 links), Sign in, Start a project, mobile Menu | Navigate; menu opens by click/keyboard, closes on Escape, restores focus | public.spec: homepage links, mobile menu |
| `/` | "Rotate the model" | Loads viewer-3d on intent only, renders frames, exposes Change colour / Reset view | public.spec: 3D demo |
| `/` | Start with a template / Explore examples / CTA links | Go to `/app/signup?template=…`, `/templates`, `/pricing`, `/help` | public.spec: link sweep |
| `/product` | Links to templates, signup | Resolve | public.spec: link sweep (from home) + a11y |
| `/templates` | Search input, category select, Clear, cards | Client-side filter, count, empty state, URL `?q=&category=` persistence | public.spec: gallery |
| `/templates/[slug]` | Use this template / Sign in and use it | Preserve `template=` through signup/sign-in | public.spec + journeys J1 |
| `/pricing` | Monthly/Yearly segmented (click + arrow keys), Choose plan ×3 | Prices, yearly note and plan links update; `?interval=` persisted | public.spec: pricing |
| `/help`, `/help/[id]` | Article cards, sidebar, on-page headings, Next | Navigate | public.spec: help |
| `/legal/privacy`, `/legal/terms` | — | noindex meta, draft label | public.spec |
| `/404`, any unknown path | Links | Served with HTTP 404 | public.spec |
| `/api/*`, `/app/assets/missing` | — | Real 404, never the SPA shell | public.spec |

## App (Vite, `apps/web`, base `/app/`)

| Route | Controls | Expected behaviour | Verified by |
| --- | --- | --- | --- |
| `/app/signin` | 3 fixture identities, email form, links to signup/recover | Session created; destination = returnTo / template / plan intent | J1, J7, J8, J9a, controls |
| `/app/signup` | Name, email, workspace, Create | Field errors (invalid/duplicate email, short name), new empty workspace, intent preserved | J1, screenshots (empty state) |
| `/app/recover` | Email, Send (simulated), Open recovery link | Link shown, never emailed; token signs in; bad token explained | unit (backend), manual |
| `/app` | Search, status segmented, template filter, New project, card menus (Rename, Duplicate, Archive/Restore, Delete…), active-run chips | URL-synced filters, no-results with preserved query, empty state, confirm dialog, viewer role explained | controls.spec: dashboard; J4 |
| `/app/projects/new` | Template radios, source segmented, upload input, fixture select, product/brief fields, aspects, Cancel/Create | Validation keeps valid fields; upload preview; rejection names file/limit; draft survives reload; template preselected from intent | controls.spec: new project; J1; J2 |
| `/app/projects/:id?tab=overview` | Run workflow, Open studio, Edit workflow, output cards | Navigate/run | J2, a11y |
| `…?tab=workflow` (canvas, Flows-style) | Node: input ports (left, typed: image/text/video/3D/scene/audio; required marked), output port (right), header (type · engine · status), output preview, prompt textarea, Run / Run-all split; footer when selected: engine select, per-kind settings (aspect, resolution, duration, preset, background…), mute, download, delete, "…" menu (Run ⌘↩, Extract generation, Download ⇧⌘D, Save to assets, Set as thumbnail, Rename, Copy ⌘C, Paste ⌘V, Duplicate ⌘D, Focus node ⌘., Reference in agent ⌘/, Delete generation, Delete node ⌫, Mark/Unmark template output, Comment) | Every item changes the document, selection, viewport or artifact state; unavailable items explain why | controls.spec: workflow canvas; J2/J5 (run/progress in node) |
| Canvas chrome | Zoom ±, Fit, Center selected, Undo/Redo, Add node; right-click menu (Add node N, Paste ⌘V, Comment C, Show agent, Quick actions ⌘K); add-node palette (search, category chips, Most used, keyboard ↑↓↩); quick-actions palette; bottom toolbar (Select V / Hand H / Comment C + 9 add-node tools); Runs drawer toggle; drag output→input with type validation | Palette adds at cursor/centre; context menu items act at the click point; hand mode pans, comment mode places a note; invalid connections are refused with a reason | controls.spec: workflow canvas; J9a |
| `…?tab=workflow` (list) | Connect-from selects, Move earlier/later, Run only, Remove, Add step | Same document without dragging | J9a, mobile.spec |
| Run panel | Stop, Pause, Resume, Answer and resume, Retry failed step / Run again, Review output, history rows, activity | Valid transitions; cancelled run drops late ticks; retry reuses outputs | J4, J5, J5b, controls |
| Composer | Enter/Shift+Enter, Send, suggestion chips | Scene/ad edits, template preset, run/cancel/retry, playback, undo/redo, export, tab; unsupported explained | controls.spec: composer |
| `…?tab=studio` | Orbit/zoom (pointer), click-select part, Reset camera, Fit, Clear selection, background/light/camera selects, swatches + custom colour, finish, placement sliders, headline/sub/CTA, brand swatches, layout, aspect, Undo/Redo, Space/⌘Z, timeline Play/Pause/Back/scrub/preset/duration, version chips, Export | Visible scene change (frames rendered), overlay text/colour, aspect container, idle stops rendering, saved + reload | J3, controls.spec: studio |
| Export dialog | Preset radios, Export and download / Queue render, Close, Again, job rows (Download MP4, Cancel, Retry) | Real PNG/WebM/JSON downloads with correct signatures; MP4 sample labelled; prerequisites explained | J6, J6b, J9c |
| `…?tab=outputs` | Acceptance select, Compare checkboxes (2), Use this version, Select, Open in Studio, Download, job rows, Open in library | Selection pinned; compare panel; downloads | J6, controls.spec: outputs |
| `/app/library` | Search, kind, project filters, item → detail dialog, Download, version links | URL-synced filters; missing artifact state | controls.spec: outputs; J9b |
| `/app/settings/profile` | Name, Save | Validation; header/menu update | controls.spec: settings |
| `/app/settings/workspace` | Name, default aspect, Save | Owner-only explained | controls.spec: settings |
| `/app/settings/notifications` | 9 switches, Save | Save disabled until dirty; simulated email log | controls.spec: settings |
| `/app/settings/members` | Role selects, Remove (confirm), invite form, Simulate acceptance, Revoke | Seat limit, duplicate/invalid email errors, member added | controls.spec: settings |
| `/app/settings/billing` | Interval segmented, Upgrade/Change ×2, Switch to Starter, Cancel subscription (confirm), Downgrade | Checkout navigation with intent; simulated cancel | J7 |
| `/app/billing/checkout` | 4 outcome buttons | Server-held session; repeated clicks do nothing new | J7 |
| `/app/billing/return` | Continue, Try again, Usage & billing | Reconciles from server; forged `success=true` ignored; pending → succeeded once | J7 |
| `/app/dev/scenarios` | 13 scenario radios, latency scale, Reset, Reseed stress, Expire session | Config applied and shown | controls.spec |
| Header | Nav collapse, New project, Notifications (Mark read), Account menu (Settings, Help, Scenarios, Sign out), offline badge/banner + Reconnect | Cache cleared on sign-out; reconnect replays | J8, J9b, controls |
| System states | Missing project, missing artifact, expired session, denied role, offline, WebGL unavailable, in-app 404, error boundary retry | Explained with recovery | J8, J9b, J9c, public.spec |

## Journeys → specs

| # | Journey | Spec |
| --- | --- | --- |
| 1 | Home → template → signup → project | journeys.spec J1 |
| 2 | Upload → brief → run → inspect 3D | J2 |
| 3 | Edit → undo/redo → play/scrub → aspect → save/reload | J3 |
| 4 | Run → leave → return/reload → recovered, no duplicate | J4 |
| 5 | Cancel → retry; failure → retry only failed | J5, J5b |
| 6 | Versions → choose → export → validate PNG/JSON/MP4/WebM | J6, J6b |
| 7 | Pricing → sign-in → checkout outcomes → entitlement/return | J7 |
| 8 | Sign out → other user → no leakage | J8 |
| 9 | Keyboard, reduced motion, mobile list, offline, expired, denied, missing, no WebGL | J9a, J9b, J9c, mobile.spec, a11y.spec |

Unit tests (`vitest`, 21): run state machine, returnTo validation, graph rules, backend idempotency, cancellation/late ticks, retry reuse, waiting-input, event replay/gaps, pinned selection, persisted-scheduler recovery, billing reconciliation/idempotency/delayed/declined, credit limits, optimistic revisions, duplicate/delete, upload rejection.

## Browser and viewport coverage

`tests/e2e/viewports.spec.ts` checks every public page and app screen above at 320×568, 390×844, 844×390, 768×1024, 1024×768, 1280×800 and 1600×1000 on Chromium, WebKit and Firefox (no horizontal overflow, primary control in view). The journeys J1–J9c also run on WebKit and Firefox. Details and findings: `docs/QA_REPORT.md`, section "Cross-browser and viewport matrix".
