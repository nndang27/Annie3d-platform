# Workspace engineering patterns (how canvas products are built)

Status: research note, 2026-09-24. What Figma, Miro, tldraw, Excalidraw, draw.io and Linear
do inside their workspaces, and what Annie 3D adopts **now**, **designs for now** (so multiplayer
later is cheap) or **adds later**. Sources at the end; code references were checked against
the public repositories.

## 1. Rendering the canvas

| Pattern | Who | What it is | Annie 3D |
| --- | --- | --- | --- |
| Viewport culling with a spatial index | tldraw (R-tree; off-screen shapes get `display:none`, ~50 of 10 000 shapes render), React Flow (`onlyRenderVisibleElements`) | Only what intersects the viewport renders; selected and edited items are never culled | **Now.** Enable React Flow culling; keep selected/running nodes mounted; add a margin ring and hysteresis so nodes at the edge do not flicker (tldraw has an open issue on culling hysteresis). |
| Debounced zoom for LOD | tldraw `getEfficientZoomLevel()` (above 500 shapes, LOD decisions use a debounced zoom while the camera moves) | Level-of-detail switches only after zoom settles, so pan/zoom never triggers re-renders | **Now.** Our zoom LOD (full / preview / card) reads a debounced zoom. |
| Image mip chain by zoom | Miro (cached images at each zoom level, each half the previous), tldraw (asset resolution from stepped screen scale × DPR) | Never decode a 2K image to show it at 80 px | **Now.** Posters in 256/512/1024; choose by `zoom × DPR`, stepped. |
| Edit mode vs view mode | Miro (a code-editor widget is live DOM only while editing; otherwise a cached image on the canvas) | Heavy interactive UI exists only for the one item being edited | **Now.** Node prompt editors mount only on focus; otherwise static text. Same idea as our 3D editor overlay. |
| Static layer vs interactive layer | Excalidraw (`StaticCanvas` for elements, `InteractiveCanvas` for selection, handles, cursors) | Moving a selection box, a wire being dragged or a remote cursor never re-renders the content | **Now.** Wire-drag preview, marquee, snap guides and (later) remote cursors live in one overlay layer above React Flow nodes. |
| rAF-throttled pointer handling | Excalidraw `throttleRAF` (one call per animation frame with the latest arguments) | Pointer and wheel events coalesce into one update per frame | **Now.** Drag, pan, wire-drag and brush selection update at most once per frame; use pointer capture. |
| Fine-grained reactivity | tldraw (signals; only dependents recompute), React Flow docs (memo nodes, targeted selectors, selection stored separately) | A change to one node re-renders one node | **Now.** Memoised node components, per-node zustand selectors, selection in its own slice, run progress routed to the one node. |
| Cached derived geometry | tldraw (bounds, hit tests, outlines cached until props change) | No recomputation during pan | **Now.** Port positions and node bounds cached per node version. |
| Hard object limit per page | tldraw (`maxShapesPerPage` 4000) | Keeps worst case bounded | **Now.** Soft limit 200 nodes per board (DOM rendering). |
| Own GPU renderer | Figma (C++ → WebAssembly tile renderer, now WebGPU), Miro (Canvas API for board content) | Needed for tens of thousands of objects | **Not needed.** DOM + React Flow is fine at our node counts; revisit only if boards exceed the limit. |
| SVG diagram engine | draw.io (mxGraph/maxGraph: SVG + HTML, client-side) | Simple, printable, exportable | Reference only. |

## 2. Data model (design now so multiplayer is cheap later)

| Pattern | Who | What it is | Annie 3D |
| --- | --- | --- | --- |
| Flat record store keyed by id | Figma (object tree as `ObjectID → properties`), tldraw (typed records) | Everything is a record: node, edge, comment, version | **Design now.** Board = map of `{id, type, props, version}` records; positions and settings are properties. |
| Client-generated ids | Figma (ids include the client id, no server round trip) | Create offline and optimistically | **Now** (the demo already mints operation ids). Use ULIDs with a client prefix for records. |
| Document state vs session state | Excalidraw (removed `canvas` and `isSelected` from elements), tldraw (instance/session records are not synced) | Selection, viewport, hover, open editor are per user, never in the document | **Design now.** Keep them in a separate local store. |
| One mutation path | Linear (every change is a transaction), tldraw (store changes batched) | UI, agent and (later) server all apply the same operations | **Design now.** `applyOps([...])` is the only way to change a board; the agent calls it too; each op carries its inverse for undo. |
| Property-level last-writer-wins | Figma | Two people editing different properties never conflict; same property: the last to reach the server wins | **Later** (with multiplayer). Our op format already carries record id + property. |
| Fractional indexing for order | Figma (arbitrary-precision fractional index), Linear | Reorder without renumbering siblings | **Design now** for z-order and ordered lists (versions, starter nodes). |
| Explicit create/delete; tombstones | Figma (explicit ops), Excalidraw (`isDeleted`, `version`, `versionNonce` tie-break) | Deletes survive merges and undo | **Design now.** Deletes are ops; records keep a `version`. |
| Schema versions and migrations | tldraw (per-record migrations so different client versions can share a room) | Old boards and old clients keep working | **Now.** Every record type has a schema version; migrations run on load. |
| Assets outside the document | tldraw (`TLAssetStore`, files in object storage), Figma | Sync carries references, never bytes | **Now.** Documents store content hashes/URLs only. |

## 3. Persistence, sync and offline

| Pattern | Who | What it is | Annie 3D |
| --- | --- | --- | --- |
| Local-first cache in IndexedDB | Linear (bootstrap then deltas; offline transactions queued in IndexedDB and resent) | Instant load, works offline | **Now** (the demo already persists to IndexedDB). Add a pending-ops queue that survives reloads. |
| Monotonic sync id + delta packets | Linear | Total order of changes; a gap means "fetch what I missed" | **Now** for run events (the demo already uses sequence numbers and replay); **later** for board edits. |
| Reconnect = fresh state + replay pending ops | Figma | Simple and robust recovery | **Later**, with multiplayer. |
| Lazy / partial loading | Linear (partial bootstrap, on-demand models) | Load what the view needs | **Now.** Board metadata eagerly; artifacts, versions and heavy media on demand. |
| Batched sends | Linear (`TransactionQueue` timers) | Fewer requests, fewer conflicts | **Now.** Debounced autosave batches ops. |

## 4. Real-time collaboration (not built now; the shape to build toward)

| Pattern | Who | What it is |
| --- | --- | --- |
| One authoritative process per document | Figma (a process per multiplayer document), tldraw sync (`TLSocketRoom`, one Cloudflare Durable Object per room, ~50 collaborators) | All clients of a board connect to one room that orders and validates changes |
| WebSockets, optimistic apply, unacknowledged local changes win locally | Figma | No flicker when the server echo is late |
| Server validation | Figma (rejects parent cycles), tldraw (schema validation) | Bad ops never persist |
| Presence on a separate ephemeral channel | Liveblocks/Yjs awareness, Excalidraw (cursors and viewports on the socket, elements persisted separately) | Cursors, selections, viewports are never stored; ~15–20 updates/s plus client interpolation (Liveblocks default throttle 100 ms, 16 ms for 60 fps) |
| Undo only your own changes | Figma (undo modifies redo history and vice versa) | Undo never erases a teammate's work |
| End-to-end encrypted rooms | Excalidraw (AES key in the URL fragment, which never reaches the server) | Optional for private share links |
| Real-time data subscriptions | Figma LiveGraph (GraphQL subscriptions fed by the Postgres replication stream) | Lists (projects, comments, credits) update live without polling |

For Annie 3D specifically: run progress is already an event stream per run; in multiplayer it
becomes a broadcast in the board's room, and artifacts arrive as record updates. Nothing
about generation needs to change.

## 5. Keeping it fast over time

| Pattern | Who | Annie 3D |
| --- | --- | --- |
| Performance tests on every pull request with a noise margin | Figma (GPU VMs, headless Chromium, 20 % margin, 10-minute target) | **Now.** Run `tests/perf` in CI on each PR; fail on > 20 % regression of pan FPS, editor-open time, heap after 20 editor cycles, LCP. |
| Real low-end hardware lab | Figma (old laptops, Chromebooks) | **Now**, cheaply: one old Windows laptop and one mid Android phone for weekly manual runs. |
| Stress scenarios | Figma ("thousands of layers, 50 editors"), tldraw (10 000 shapes) | **Now.** Board with 200 nodes and 5 running at once; later, simulated collaborators. |
| Built-in performance events | tldraw (`editor.performance`: interaction-end, camera-end) | **Now.** Emit our own interaction timings to real-user monitoring. |
| Watch CSS | Figma (a `backdrop-filter: blur(0)` caused a regression) | Floating pill chrome uses blur: measure it, keep a flat fallback. |

## 6. What changes in our plan because of this

1. React Flow culling + margin ring + hysteresis; debounced zoom drives LOD.
2. Overlay layer for all transient interaction (wire drag, marquee, guides, later cursors).
3. Prompt editors mount only while focused.
4. Board state as versioned records with one `applyOps` path used by UI and agent;
   session state kept out of the document; schema migrations from day one.
5. Pending-ops queue in IndexedDB; batched autosave.
6. Perf CI gate with a 20 % margin plus a small real-device lab.

## 7. What comparable workspaces are built with (checked 2026-09-24)

Method: response headers and the JavaScript each site serves to a browser were scanned for
framework and library signatures. "Verified" means seen in served code; "reported" means
from docs, blogs or third-party write-ups only.

| Product | App framework | Canvas / rendering | State | Evidence |
| --- | --- | --- | --- | --- |
| **ElevenLabs Flows** | Next.js App Router, React | React Flow (`@xyflow`, `react-flow__node` classes) with DOM nodes; three.js and wavesurfer in the bundle | MobX | Verified: `x-powered-by: Next.js`, `self.__next_f`, 298 chunks scanned |
| **Krea** (site incl. /nodes) | SvelteKit | Editor not inspectable without login | — | Verified: `/_app/<hash>/immutable/` asset paths; canvas library unknown |
| **Figma Weave** (ex-Weavy) | Next.js for the marketing page | — | — | Page blocked automated fetch; stack write-ups found online describe clones, not Weave itself |
| **Runway** app | React SPA | Canvas 2D, OffscreenCanvas, Web Workers | Redux + Zustand | Verified in served bundle |
| **Meshy** | Next.js App Router, React | three.js signature present, small counts | Zustand | Verified framework; 3D library uncertain |
| **Lovable** | Editor not inspectable (Cloudflare challenge) | — | — | Apps Lovable *generates* are React + Vite + Tailwind + shadcn/ui (reported) |
| **Excalidraw** | React SPA on Vite | Canvas 2D (`StaticCanvas` + `InteractiveCanvas`), Rough.js | Jotai | Verified: Vite `/assets/index-*.js`, source on GitHub |
| **tldraw** | React SPA on Vite | DOM + SVG shapes, culling, R-tree | Own signals (`@tldraw/state`) | Verified in bundle and source |
| **Figma** | React UI around a C++ → WebAssembly engine | Own tile renderer on WebGL, now WebGPU | Own | Reported by Figma's engineering blog |
| **Miro** | Next.js app shell | Board content on Canvas API, LoD image caches | — | Verified header; rendering reported by Miro Engineering |
| **Linear** | React (marketing on Next.js) | — | MobX + own sync engine | Reported (reverse-engineering write-up) |
| **draw.io** | Plain JavaScript | mxGraph/maxGraph: SVG + HTML | — | Reported |
| **Annie 3D (this repo)** | React 19 SPA on Vite 8 + Astro 7 static site | React Flow 12 DOM nodes; three.js 0.186 in the editor | Zustand 5 + TanStack Query | This repository |

Why teams choose what they choose:

- **Next.js** (ElevenLabs, Meshy, Miro shell, Luma): one codebase for SEO pages, auth
  middleware and a very large product surface with many teams. The canvas itself still runs
  as a client component.
- **Vite SPA** (Excalidraw, tldraw, Runway): the workspace is a pure client app, local-first,
  statically hosted; no server rendering needed where the user is editing.
- **SvelteKit** (Krea): smaller runtime and compiled reactivity; a team preference.
- **Rendering**: DOM/React Flow when nodes carry rich media and controls (ElevenLabs, us);
  Canvas 2D for drawn content at scale (Excalidraw, Miro); a custom GPU engine only at
  Figma's scale.
- **State**: fine-grained observables (MobX at ElevenLabs and Linear, signals at tldraw) or
  small stores with selectors (Zustand/Jotai at Excalidraw, Runway, us). All avoid one big
  store that re-renders the canvas.

Decision: keep the current stack. The canvas layer matches the closest competitor
(React + React Flow + three.js). Splitting a static Astro Home from a Vite SPA fits a
canvas-first product with SEO only on Home. Share pages with Open Graph previews can be
rendered by Astro or an edge function; Next.js is not required for that.

## Sources

- Figma: How Figma's multiplayer technology works; Realtime editing of ordered sequences;
  Keeping Figma fast; Figma rendering: powered by WebGPU; LiveGraph: real-time data fetching.
- tldraw: docs on performance, culling and sync; source `packages/editor/src/lib/editor/Editor.ts`
  (`getEfficientZoomLevel`).
- Excalidraw: Building Excalidraw's P2P collaboration feature; End-to-end encryption in the
  browser; source `packages/excalidraw/components/canvases/` (`StaticCanvas`,
  `InteractiveCanvas`) and `packages/common/src/utils.ts` (`throttleRAF`).
- Miro Engineering: How we integrated a code editor on the Miro canvas (LoD image caching).
- React Flow: Performance guide.
- Linear: reverse-linear-sync-engine (endorsed by Linear's CTO).
- Liveblocks: live cursors tutorial (presence throttle).
- draw.io: mxGraph/maxGraph documentation.
- Stack table: served HTML/JS fingerprints (headers, asset paths, library signatures), 2026-09-24.
