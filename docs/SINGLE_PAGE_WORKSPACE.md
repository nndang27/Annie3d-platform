# Single-page workspace: layout, engineering notes, tooling

Status: design for founder review (2026-09-24). The product is **one page**: the canvas
workspace. Home/landing stays a separate static page for SEO only. Features F1–F12 are
defined in `MVP_STRATEGY.md`. Numbers marked *target* are budgets to verify, not measurements.

## 1. What the reference screen does (ElevenLabs Flows, "Product showcase")

| Region | Element | Behaviour |
| --- | --- | --- |
| Top-left pill | App switcher "Flows ▾", project title | Title is editable; switcher leads to other projects. |
| Top-right pills | Create Template · zoom 68 % ▾ · save status (cloud) · comments · assets (folder) · agent panel toggle · Share · avatar | Grouped into two floating pills; nothing spans the full width. |
| Canvas | Dotted infinite plane | Floating chrome only; no sidebars except the agent panel. |
| Input node | Label above ("Product front view"), image fills the card, "Run from here" on hover, footer pill: Replace · download · delete · … | Output port on the right edge. |
| Generator node | Label + model name above; typed input ports on the left (image ×3, video, audio, text); preview area with reference thumbnails; prompt with **@mentions of other nodes** as chips; split "Run ▾"; footer pill: model · 16:9 · 1080p · 10s · audio · download · delete · … | Prompt is inside the node; settings are in the footer, not a side inspector. |
| Bottom-centre | Select · Hand · Comment · **+** (add node) | Minimal: node types live behind "+". |
| Right dock | "Flows Agent · Alpha" with status dot; new chat, history; empty state; composer with attach, model/brain, **"Auto under 300 credits ▾"** budget, send | Agent is a docked panel, not a floating bar. |
| Corners | "Display a menu" hint bottom-left; "Feedback" bottom-right | Discoverability of right-click; feedback always one click away. |

What to keep: floating pill chrome, prompt-in-node with @mentions, footer pills per node,
budget-capped agent composer, "Run from here". What we change: our nodes produce 3D, which is
heavy, so the canvas never renders live 3D (section 4.1), and we add an editor overlay for 3D.

## 2. Redesigned layout for 3Dads

### 2.1 Page regions

The canvas is a **free node graph**, exactly like the reference: any node can be added
anywhere and wired to any compatible port. Nothing is locked into a fixed pipeline.

```
┌ ◧ 3Dads ▾ │ Serum launch ✎ │ ● Saved ─────────── [ Starters ▾ ]  [ ▶ Run all · 38 cr ] ─── 72% │ 💬 │ ⧉ │ 480 cr │ Share ▾ │ (A) ┐
│                                                                                                           │ Agent ● │
│  [Photo: serum front] ●──╮                    ╭──● [Packshot: ¾ hero]                                     │         │
│                          ╰──● [3D model v3] ●─┤                                                           │  plan / │
│                                               ╰──● [Stage: splash, pastel] ●──╮                           │  steps  │
│  [Text: "Meet the new formula"] ●─────────────────────────────────────────────┴──● [Ad video 9:16 10s] ●  │         │
│                                                                                                           │ ┌─────┐ │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐                                                                                      │ │Desc…│ │
│    Drop your product photo                                                                                │ └─────┘ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ┘            ┌──────────────────────────────────────────────┐                        │         │
│                                 │ ↖ ✋ 💬 │ ＋ Photo Text 3D Stage Packshot Video Export │                        │         │
└─────────────────────────────────┴──────────────────────────────────────────────┴────────────────────────┴─────────┘
```

- **Top-left pill**: logo menu (Home, My projects, Help, Sign in/out), editable project
  title, save state (Saved / Saving / Offline, local-first).
- **Top-centre**: **Starters ▾** replaces "Create Template": the three production lines
  (Teardown reveal, Stone & water, Splash hero) with 4-second previews. Choosing one drops
  **ordinary, editable nodes** pre-wired on the canvas: no frame, no lock. The user can delete,
  rewire, duplicate or add nodes afterwards. The line's special behaviour lives in node
  presets (Stage look "Splash, pastel", Ad video motion "Splash hero"), so any user-built
  graph can pick the same presets. **Run all** runs every stale node in dependency order and
  shows the total estimated cost.
- **Top-right pill**: zoom, comments, assets (uploads + outputs of this project), agent
  panel toggle, **credits meter** (F11), **Share ▾** (F10, F12), avatar.
- **Right dock**: agent panel (F7), collapsible to an icon; resizable; on phones becomes a
  bottom sheet. The composer carries a credit budget (≤ N credits ▾) like the reference.
- **Bottom-centre dock**: Select · Hand · Comment, then **＋** (full palette, also on
  right-click and `N`) and one-tap buttons for every MVP node kind: Photo, Text, 3D model,
  Stage, Packshot, Ad video, Export. Dragging a wire from an output port into empty space
  opens the palette filtered to nodes that accept that port type. The region brush is not
  here; it lives in the 3D editor.
- **Corners**: right-click hint bottom-left; Feedback bottom-right (feeds the alpha loop).

### 2.2 Node anatomy (all node kinds share it)

```
 label ✎                                   engine · v3 ‹ ›
┌─────────────────────────────────────────────────────────┐
│ ● in ports      OUTPUT PREVIEW                          │ ● out port
│ (typed, left)   poster image / looping turntable clip   │
│                 [ Open 3D ⤢ ]  [ Run from here ]  on hover
├─────────────────────────────────────────────────────────┤
│ prompt with @Photo front chips …            [ Run · 12 cr ▾ ] │
└─────────────────────────────────────────────────────────┘
      footer pill: preset ▾ · 9:16 · 10 s · ♪ · ⤓ Export ▾ · 🗑 · …
```

- **Header**: editable label; engine name; **version switcher ‹ v3 ›** (F9).
- **Status**: a thin progress bar under the header while running, with step name and
  elapsed time; failed gate shows the gate name and "credit refunded".
- **Run button shows its cost** before the click (F11).
- **Output preview never uses WebGL** (section 4.1). 3D nodes show a poster; on hover or
  focus they play a short pre-rendered turntable clip. **Open 3D** opens the editor.

### 2.3 Node kinds (MVP) and port types

Port types, each with its own colour on the port dot and wire: `image` (blue), `text`
(grey), `model3d` (purple), `scene` (teal), `video` (coral), `file` (neutral). A wire can
only connect matching types; incompatible ports dim while dragging.

| Node | Inputs (left) | Output (right) | Prompt / settings | Feature |
| --- | --- | --- | --- | --- |
| Photo | — | image | replace, crop | F2 input; first-visit ghost slot |
| Text | — | text | free text: brief, headline, CTA, or a text-to-3D description | F3, captions |
| Upload 3D | — | model3d | GLB/glTF/OBJ/STEP import | skip building |
| 3D model | image ×n, text | model3d | prompt; builder Auto / Code / Generative; detail | F2, F3 |
| Stage | model3d, text, image (style ref) | scene | look preset (Studio, Splash pastel, Stone & water, Dark lab…), background, light | look |
| Packshot | model3d or scene | image | camera: 4 auto angles or framed in the editor; size | F4 |
| Ad video | scene or model3d, text (headline), image (logo) | video | motion preset (Turntable, Hero orbit, Teardown reveal, Splash hero, Stone & water); aspect; duration | F5 |
| Export | model3d, scene, video, image | file | GLB presets (Web, Google Merchant, Google Swirl) with pass/fail, MP4 set, PNG set | F6 |
| Note | — | — | sticky note | canvas notes |

Rules: any number of nodes; one output fans out to many inputs; a node shows **stale** when an
upstream node changed; `Run` on a node offers Run this node / Run from here / Run with
upstream. Every node keeps its versions (F9).

### 2.4 3D editor overlay (F8, F9, F4)

Opens over the canvas (the canvas stays mounted and paused underneath), URL gets
`?edit=<nodeId>` so it is shareable and Back closes it.

```
┌ ‹ Back to canvas │ 3D model · v3 ‹ › │ Compare ◧ │                 Export ▾ │ ✕ ┐
│ ┌──┐                                                                    │ Agent │
│ │↻ │  Orbit                                                             │ ctx:  │
│ │🖌│  Brush select                 WebGL viewport                       │ [3D model v3]
│ │⬡ │  Lasso select                                                      │ [2 regions]
│ │⌫ │  Clear selection                                                   │       │
│ │📷│  Frame packshot (F4)                                               │ "make │
│ │☀ │  Light preset ▾                                                    │ the cap│
│ └──┘                                                                    │ matte" │
│ ── version strip: v1 v2 [v3] · before/after ── timeline ▶ 0:00 / 0:10 ──│   ↑   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Six tools only**: orbit, brush, lasso, clear, packshot camera, light preset. No
  transform gizmos, no vertex tools (founder decision).
- The **agent panel stays docked** and switches context: chips show the node, version and
  selected regions; the message applies to that selection.
- Every agent edit creates a version; Compare shows a split slider before/after.
- Packshot camera: the user frames a view and presses 📷; a Packshot node is created on the
  canvas with that camera, wired to this model.

### 2.5 Share (F10, F12)

Share ▾ offers: **Link to this output** (viewer page for a model, video or packshot),
**Link to this board** (read-only canvas), **Process reel** (queued render, notifies when
ready), **Embed code**, **Download**. Visibility: public or unlisted; revoke anytime.

### 2.6 First visit (F1)

The example board loads as ordinary nodes with outputs already rendered. Beside it a ghost
Photo node says "Drop your product photo"; dropping a photo there fills it and the user wires
it (or asks the agent, or picks a Starter) like any other node. Dropping a photo
asks for Google one-tap sign-in only when Run is pressed (F11). No tour modal; a single
coachmark on the ghost slot.

### 2.7 Small screens

Same canvas, scaled (founder decision). Agent panel is a bottom sheet; the bottom dock keeps
the four core buttons; the editor is full-screen. One-finger drag pans the canvas, inside the
editor it orbits. Hover previews become tap-to-play.

## 3. Feature → UI map

| Feature | Where it lives |
| --- | --- |
| F1 canvas-first | `/` loads the workspace with the example board; Home is `/home` (static) |
| F2 image-to-3D | Photo → 3D model node |
| F3 text-to-3D | Text → 3D model node, or ask the agent |
| F4 3D-to-image | Packshot node; 📷 in the editor |
| F5 3D-to-video | Ad video node with a motion preset; Starters ▾ drops a pre-wired graph |
| F6 GLB export | Package node and Export ▾; preset badges pass/fail |
| F7 agent | Right dock, budgeted composer |
| F8 region edit | Editor overlay brush/lasso + agent with selection context |
| F9 versions | ‹ v › on every node header; version strip + Compare in the editor |
| F10 share link | Share ▾ in the top-right pill |
| F11 accounts/billing | Avatar, credits meter, cost on Run, one-tap sign-in on first own run |
| F12 process reel | Share ▾ → Process reel; also on the Package node |

## 4. Engineering notes

### 4.1 Rendering and performance (frontend)

1. **No live 3D on the canvas.** 3D nodes show a poster (AVIF/WebP) and, on hover/focus, a
   short pre-rendered turntable clip (muted MP4 or sprite). WebGL exists only in the editor.
2. **One WebGL context for the whole app**, created once and reused by every editor open;
   geometries, textures and materials are disposed on close; heap must return to baseline
   after 20 open/close cycles. Browsers cap live WebGL contexts, so per-node viewers are not
   an option.
3. **Viewport culling, game-style.** Node positions/metadata for the whole board are small
   and load at once; **heavy payloads stream by viewport**: React Flow's
   `onlyRenderVisibleElements` for DOM (not enabled in the current demo), a spatial grid over
   node bounds to decide which media to mount, a margin ring that prefetches in the pan
   direction (velocity-based), and unmounting media that leaves the ring.
4. **Level of detail by zoom.** ≥ 60 %: full node. 30–60 %: preview image at lower resolution,
   no prompt editor, no video. < 30 %: coloured card with label and status only. Image
   sources pick a size (256/512/1024) from zoom × devicePixelRatio.
5. **At most one video playing** on the canvas (the hovered one); all node videos
   `preload="none"` with a poster.
6. **Re-render discipline.** Node components memoised; zustand selectors return primitives or
   stable references; run events update only the affected node's slice; edges are not
   re-created on progress ticks; no per-frame React state during pan/zoom.
7. **Main-thread budget.** Draco/meshopt/KTX2 decoding in workers; GLB parsing off the main
   thread; long tasks split so pan/zoom stays ≥ 55 fps *target* with 100 nodes on a mid
   laptop; INP ≤ 200 ms *target*.
8. **Code splitting.** Initial JS = canvas shell + example board only. The editor (Three.js)
   chunk is prefetched on hover of "Open 3D" and on idle after first paint; the agent
   panel, share dialogs and billing are separate chunks.
9. **Instant first paint.** The example board ships as a static JSON snapshot with posters
   on the CDN, no blocking auth call; LCP element = the example 3D node poster, ≤ 2.5 s p75
   on mobile *target*.
10. **GLB delivery.** Draco or meshopt geometry, KTX2 textures, a low LOD first then the
    full LOD; cached by content hash (Cache Storage / IndexedDB).
11. **Local-first state.** Board edits apply locally (IndexedDB), sync debounced with an
    operation log and idempotent operation ids; a second tab of the same project gets a
    read-only banner (BroadcastChannel lock) instead of silent conflicts.
12. **Uploads.** Client-side downscale and EXIF strip, HEIC → JPEG on iPhone, direct upload to
    object storage with presigned multipart URLs, resumable.
13. **Undo/redo** for canvas edits; agent edits are versions, not undo steps.
14. **Accessibility.** Keyboard navigation between nodes, list view as the non-canvas
    alternative (exists in the demo), visible focus, reduced motion disables hover clips.
15. **Soft limit** of 200 nodes per board in the MVP; beyond it, suggest a new board.

### 4.2 Backend

1. **Durable run orchestration.** Runs take minutes and span CPU, LLM and GPU steps. Use a
   durable workflow engine (Temporal, Inngest, Restate or a DB-backed queue) with one step
   per node, retries, idempotency keys, cancellation and resume after crashes.
2. **Per-node result cache.** Key = hash(node kind, settings, prompt, input artifact hashes,
   engine version). "Run from here" and reruns skip unchanged upstream nodes.
3. **Separate queues by resource**: code builder (CPU + LLM), generative builder (GPU),
   preview render (GPU, fast), final render (GPU, path tracing for jewelry), packaging
   (CPU: GLB optimisation, USDZ, MP4 muxing). Autoscale per queue; show queue position.
4. **Progress streaming.** Server-Sent Events (or WebSocket) with sequence-numbered events and
   resume from the last sequence; early preview frames pushed before final render.
5. **Credits ledger.** Estimate before Run, reserve on start, settle per step, refund on gate
   failure; double-entry ledger; payment webhooks idempotent; agent budget cap enforced
   server-side.
6. **Assets.** Content-addressed object storage (S3/R2) behind a CDN, immutable caching;
   derived variants produced asynchronously: poster sizes, turntable clip, GLB LODs, preset
   exports (Web, Google Merchant ≤ 15 MB, Google Swirl ≤ 3 MB), USDZ.
7. **Share service.** Static-rendered share pages with Open Graph image + `og:video` so links
   preview in Facebook/Telegram/Zalo; lightweight viewer; unlisted tokens; revoke; view
   counts; "Made with 3Dads" CTA.
8. **Agent service.** The agent calls the same graph-operation API the UI uses (add node,
   connect, set prompt, run), so every agent action is visible and undoable on the canvas.
   Region edits send the selection (face ids or mask) and rendered views of the selection.
9. **Process reel service.** Replays the run's event log in a headless renderer, composes it
   with the final ad (ffmpeg), queued after the run.
10. **Guest → account.** Guest boards live in IndexedDB; on sign-in they are uploaded and
    claimed. One free full run per account, enforced server-side, plus device and rate
    limits.
11. **Safety.** Upload type sniffing and size caps, GLB sanitisation, moderation of prompts
    and images, trademark/counterfeit checks on generated ads, watermark on free outputs.
12. **Observability.** Traces per run and per step (duration, cost, gate result), real-user
    web vitals (LCP, INP, CLS) from the canvas page, error tracking, eval dashboards per line.
13. **Security.** Strict CSP on the app and share pages, signed short-TTL URLs for private
    assets, no user-supplied HTML rendered anywhere.

### 4.3 Product notes

- Every long action shows what is happening now and what it costs.
- Failure copy names the gate and the fix ("the photo is cropped at the base; retake with
  the whole bottle visible"), never a generic error.
- Autosave always; no Save button.
- Nothing requires an account until the first own run.


### 4.4 Delta from the current demo code

| Note | Demo today | Needed |
| --- | --- | --- |
| No WebGL on canvas | Canvas nodes show images; 3D lives in the Studio tab (`components/studio/ViewerPanel.tsx`) | Move the viewer into the editor overlay; nodes get poster + turntable clip |
| One WebGL context | `ViewerPanel` creates a `ProductViewer` (new renderer) per mount and disposes it on unmount | A single app-level viewer instance handed to the overlay on open, scene swapped, renderer kept |
| Viewport culling | `onlyRenderVisibleElements` not enabled; all media mount | Enable it; add the media ring and zoom LOD |
| Memoised nodes | `FlowNode` is wrapped in `memo`; selectors return primitives | Keep; add per-node run-event slices |
| Tabs (Overview/Workflow/Studio/Outputs) | Four project tabs | Collapse into the single canvas page + editor overlay + Share |

## 5. Tooling: web-quality-skills, Chrome DevTools MCP, Vercel agent skills

Read from the local clones in `Production_system/SKILLS_for_code/` (web-quality-skills
`afa8da9`, chrome-devtools-mcp `6a7e51f`, agent-skills `063bee9`).

### 5.1 Division of labour

| Layer | Owner | Why |
| --- | --- | --- |
| **Measure** (traces, Lighthouse, heap, throttling, device emulation) | Chrome DevTools MCP | The only one of the three that touches a real browser. |
| **Audit method** (what to measure, thresholds, report format, measured vs hypothesis) | web-quality-skills | Evidence-first workflow; routes to the MCP tools. |
| **Write the code** (React re-render, bundle, async, composition) | Vercel react-best-practices + composition-patterns | Static code rules applied while writing and reviewing. |
| **Interaction and interface detail** (focus, forms, motion, touch, URL state) | Vercel web-design-guidelines | 100+ UI rules, `file:line` findings. |
| **Canvas FPS, WebGL, long-session memory** | Our own perf scripts (`tests/perf/*.mjs`) + MCP heap tools | None of the three skills covers them. |

### 5.2 web-quality-skills (MIT)

| Skill | Verdict | Use it for |
| --- | --- | --- |
| core-web-vitals | **Use** | LCP of the canvas page and the Home page; `references/INP.md` for canvas interactions (split input delay / processing / presentation, `scheduler.yield()`, paint feedback first). Skip its Next.js/Nuxt sections. |
| accessibility | **Use** | WCAG 2.2; especially 2.5.7 Dragging Movements (every drag needs a single-pointer alternative: our list view and "connect" menu), 2.5.1 pointer gestures, 2.1.4 single-key shortcuts (our N, C, V, H keys need a way to turn them off or require focus). |
| best-practices | **Use** | CSP with nonces, Trusted Types, SRI, `sourcemap: 'hidden'` in Vite, passive listeners, AbortController cleanup, error boundaries. Add CSP allowances for workers, `blob:` and wasm that Three.js decoders need. |
| performance | **Partial** | `references/MEASUREMENT.md` (≥ 3 runs, median + range, conditions recorded) and `references/RUM.md` (p75 per route, release id). Its budgets assume content pages; its "debounce scroll" advice is wrong for continuous pan. |
| web-quality-audit | **Partial** | Orchestration and the report format with an evidence table. Its `scripts/analyze.sh` only greps built HTML; a smoke test at most. |
| seo | **Partial** | Home page only; add our own rule that app routes are `noindex` and the sitemap lists Home, share pages and help only. |

### 5.3 Vercel agent-skills (README says MIT; no LICENSE file in the repo)

| Skill | Verdict | Use it for |
| --- | --- | --- |
| react-best-practices | **Use** | ~57 of 70 rules apply to a Vite SPA. Key for the canvas: `rerender-memo`, `rerender-no-inline-components` (define `nodeTypes` outside components), `rerender-derived-state` (`useStore(s => s.selectedId === id)`), `rerender-defer-reads` (`getState()` in handlers), `rerender-use-ref-transient-values` (drag/hover values), `rerender-transitions` (palette search), `bundle-dynamic-imports` + `bundle-preload` (lazy editor, preload on hover), `js-index-maps`, `js-request-idle-callback` (autosave), `rendering-activity` (keep the editor and agent panel state while hidden). Ignore the 10 `server-*` rules; translate `next/dynamic` → `React.lazy`/TanStack lazy routes and SWR → TanStack Query. Do not make React Flow's wheel/touch listeners passive. |
| composition-patterns | **Use (partial)** | Explicit node variants built from shared `Node.Header/Body/Ports/Footer` parts instead of one node with many flags; `{state, actions, meta}` interfaces for editor and agent panel backed by zustand. Never put per-frame canvas state in React context. |
| web-design-guidelines | **Use** | UI review before each merge. Fetches its rules from GitHub on every run (network needed, rules can change); pin a copy if reviews must be reproducible. |
| writing-guidelines | Partial | Home page copy and docs only. |
| react-view-transitions | **Later** | Node → editor morph and agent panel slide are good fits, but it needs `react@canary` outside Next.js, and named elements ignore input during a transition. Never wrap canvas pan/zoom or node drags. Revisit when `<ViewTransition>` is stable. |
| vercel-optimize, deploy-to-vercel, vercel-cli-with-tokens, react-native-skills | Skip | Vercel-hosted or React Native only. `deploy-to-vercel` can upload a project tarball to a Vercel endpoint without login; do not install it. |

Ignore the `.zip` files in that repo: they are stale snapshots.

### 5.4 Chrome DevTools MCP (Apache-2.0)

Version 1.10.1. Node `^20.19 || ^22.12 || >=23`, current stable Chrome.

**Install (MCP only, with flags; do not use the plugin install).** The plugin pins the server
with no flags, so heap analysis is off and telemetry plus CrUX lookups are on.

```bash
claude mcp add chrome-devtools --scope user -- npx -y chrome-devtools-mcp@latest --isolated --no-usage-statistics --no-performance-crux --memoryDebugging --viewport=1440x900
```

- `--isolated`: a temporary profile; otherwise IndexedDB (our demo state) persists between runs.
- `--no-performance-crux`: otherwise every trace sends the page URL to Google's CrUX API.
- `--no-usage-statistics`: telemetry is on by default.
- `--memoryDebugging`: unlocks the 13 heap-analysis tools; only `take_heapsnapshot` exists without it.
- Keep it **headed** for WebGL numbers; headless falls back to software GL. Check the renderer
  with `evaluate_script` reading `WEBGL_debug_renderer_info`.

Copy the useful skills from `skills/` into the project's `.claude/skills/`:

| Skill | Verdict | Use it for |
| --- | --- | --- |
| chrome-devtools | **Use** | Baseline usage: navigate → wait → snapshot → act by uid; large outputs to `filePath`. |
| memory-leak-debugging | **Use** | 3D editor open/close leak: baseline snapshot → repeat 10× → snapshot → compare → retainers. GPU memory is not in the JS heap: also read Three.js `renderer.info.memory`. |
| a11y-debugging | **Use** | Toolbar, dialogs, editor overlay, Home: Lighthouse a11y, console issues, tab-through focus checks, tap-target and contrast snippets. WebGL content is invisible to the accessibility tree. |
| debug-optimize-lcp | **Use** (Home), **Partial** (app) | LCP breakdown workflow. `<canvas>` is never the LCP element; the app's LCP is the example node poster. |
| chrome-devtools-cli | **Partial** | Scripted loops (20× editor open/close, repeated traces) with fewer tokens; experimental. |
| troubleshooting | Use when needed | Server start and connection failures. |
| cookie-debugging | Skip | Until sign-in and a consent banner exist. |

Tools that matter to us: `performance_start_trace` / `performance_stop_trace` /
`performance_analyze_insight` (INPBreakdown, LCPBreakdown, CLSCulprits, ForcedReflow,
NetworkDependencyTree, RenderBlocking…), `emulate` (one call with viewport, CPU 1–20×, network
preset; each call resets anything omitted), `lighthouse_audit` (no performance category;
snapshot mode keeps canvas state), `take_heapsnapshot` + `compare_heapsnapshots`,
`evaluate_script`, `take_snapshot`, `press_key`, `drag`, `navigate_page` with `initScript`.

Limits for a canvas app:

- **No FPS tool.** Measure frames in the page (rAF counter, `long-animation-frame` observer)
  injected with `initScript` and read with `evaluate_script`; our perf scripts already do this.
- **No wheel, pointer-move path or pinch tool.** `drag` goes element to element only, so
  canvas pan/zoom smoothness stays with our Playwright perf scripts. Synthetic
  `dispatchEvent` input does not count toward INP.
- **Trace defaults:** `reload` and `autoStop` default to true in code; pass
  `reload:false, autoStop:false` for interaction traces. One trace at a time; tool round trips
  appear as idle gaps.
- `list_network_requests` has no timings; use the trace for waterfalls.
- Optional later: the experimental third-party tools let the app register its own debug
  tools (for example `getFps`, `openCloseEditor(n)`) that the agent can call.

### 5.5 How they combine in our loop

1. **Write**: code with react-best-practices and composition-patterns in context.
2. **Review**: web-design-guidelines on changed UI files; fix `file:line` findings.
3. **Measure**: web-quality-skills' method, executed with Chrome DevTools MCP against the
   production preview (`pnpm build && pnpm preview`), mobile throttling by default:
   - load: `navigate_page` → `performance_start_trace` (reload, autoStop) → `performance_analyze_insight`;
   - interaction: `performance_start_trace` (no reload) → `drag`/`click` on the canvas →
     `performance_stop_trace` → INP and long-task insights;
   - memory: `take_heapsnapshot` → open/close the 3D editor 20 times → `take_heapsnapshot`
     → `compare_heapsnapshots`;
   - a11y/best practices/SEO: `lighthouse_audit` (snapshot mode to keep canvas state).
4. **Guard**: our Playwright perf scripts keep FPS, WebGL and memory budgets in CI, because
   the skills do not gate regressions.
5. **Report**: web-quality-audit's format; measured findings and code hypotheses in
   separate columns.
