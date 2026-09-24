# Annie 3D 3D workflow design

> Superseded for the first release by `MVP_STRATEGY.md` and `MVP_VERTICAL_WORKFLOWS.md` (2026-09-24). Kept as the long-term catalogue.

Status: proposal for founder review (2026-09-13). Nothing in this document is implemented yet
unless the "Current implementation" section says so. The demo app today ships the Flows-style
canvas and a first node catalogue; this document defines the catalogue we should converge on.

## 1. What we are designing for

A merchant or agency arrives with **one product** (photos, or a CAD/GLB file) and needs several
deliverables from the same product, repeatedly, per campaign:

| Deliverable class | What the customer ships | Where it goes |
| --- | --- | --- |
| **A. Video ad** | 4–15 s clip, 1:1 / 4:5 / 9:16 / 16:9, with captions and brand plate | Meta, TikTok, YouTube, retail media |
| **B. Interactive 3D** | `.glb` (+ `.usdz` for iOS AR), optimised, with a poster | Product page, Google 3D search, Meta 3D ads, Shopify 3D |
| **C. Video → 3D reveal** | A video plays, then the same product becomes an interactive 3D object at the exact pose where the video ended | Landing pages, launch pages, email → landing, in-app stories |
| **D. Living portfolio** | Animated 3D widgets that replace the static product photos on a website | Brand sites, agency portfolios, catalogues |

The deliverables share one source of truth (the product twin), one accepted look (scene,
materials, camera language) and one approval trail. That is the thing neither ElevenLabs Flows nor
Adobe sells today: Flows has no notion of a product twin, and Adobe's digital-twin templates stop
at images and a spin video.

## 2. What the incumbents do (researched 2026-09-13)

### 2.1 Adobe Firefly Creative Production — 3D digital twins

Sources: Adobe Help "Create marketing content with 3D digital twins" (blocked for automated
fetch, summarised via search snippets and the founder's three screenshots), Adobe business pages
for digital twins and production workflows, the Adobe–NVIDIA partnership announcement, Firefly
Services Substance 3D API docs, and Substance 3D Viewer / Project Neo help pages.

What it is: a cloud-native engine that turns a photoreal product model into images and video.
Three starter templates:

| Template | Graph (from screenshots) | Settings visible on the nodes |
| --- | --- | --- |
| Standardized Packshots | Input 3D → Render 3D Scene → Output images | Output size 2688×1536, background colour, zoom factor, ground plane, environment exposure/rotation, camera-view checklist (front, left, right, back, bottom, top, ¾ front L/R, ¾ back L/R) |
| Composite Imagery (3D) | Input 3D → 3D Viewer + Input text → Composite images (3D) → Output images | Hero object, output resolution, content type, auto-generate ground plane, variations, seeds, lighting seeds |
| 360 Spin Video | Input 3D → 3D Viewer / Render 360 Spin Video → Output video | Seconds, zoom, background, environment IBL |

Tech: NVIDIA Omniverse RTX rendering and Kit App Streaming for previews, Substance 3D
Automation Services for final renders, USD interchange, Frame.io for assets, the Workflow Builder
for chaining "2D actions" (resize, colour grade, composite, generate image/video) after the 3D
node. The Substance 3D API exposes render-object (GLB/glTF → PNG), 3D-object composite (model +
prompt → image, with variations and lighting seeds) and scene services (assemble, convert,
inspect); spaces expire after six hours.

Where it stops, from the customer's side:

1. **Input must already be a digital twin.** Enterprise customers have CAD; SMB merchants and
   agencies have photos. Adobe's photo→3D path (Substance 3D Viewer Text-to-3D / 3D-Model-to-Image)
   was a beta plug-in whose viewer was discontinued in October 2025.
2. **Outputs are images and a spin video.** No `.glb` deliverable, no AR bundle, no interactive
   embed, no website widget. The customer still needs a 3D commerce vendor (Threekit, Emersya,
   VNTANA…) for anything interactive.
3. **No ad packaging.** No aspect-ratio pack, caption/plate layers, hook/CTA timing or per-channel
   specs. Those are hand-made in Express/Premiere afterwards.
4. **No hybrid video→3D story**, and no continuity between the video's final camera and the
   interactive object.
5. **Review is external** (Frame.io). Acceptance is not a node in the graph, so "what did the
   client approve" is not attached to the artifact lineage.
6. Enterprise-only pricing and an NVIDIA streaming stack. Not something a small brand opens on
   a Tuesday to ship a TikTok.

Good ideas we should keep: the camera-view checklist as a first-class setting, ground plane and
environment IBL as scene settings, lighting seeds for repeatable variations, and "chain 2D
actions after the 3D render".

### 2.2 ElevenLabs Flows

A general media graph: every node has typed inputs (image/text/video/3D), an output preview on
top, a prompt and tool row, and a footer menu. It is a very good **interaction model** and we have
adopted it. It is not a product pipeline: it does not know that two nodes refer to the same object,
it cannot guarantee the object in the video is the object in the `.glb`, and it has no acceptance
or delivery semantics.

### 2.3 3D commerce vendors (Threekit, Emersya, VNTANA, Spline)

They own the interactive deliverable (configurators, AR, viewers) and the optimisation pipeline,
but they start from a finished 3D asset and do not make ads. Merchant evidence they publish:
3D/AR product pages report double-digit conversion lifts and return-rate reductions (Shopify and
vendor case studies; treat the exact percentages as marketing claims, the direction is consistent).

## 3. Design principles

1. **One twin, many deliverables.** Every graph starts from a `Product twin` artifact. Every
   output node carries `twinId` + `twinRevision` so a `.glb`, an MP4 and a packshot can be proven
   to be the same object at the same revision.
2. **Ports are typed by product state, not by file.** `model3d` is not "a GLB"; it is a twin with
   known scale, up-axis, part names and material slots. A `shot` is a camera + light + scene
   choice, reusable by images, video and the interactive viewer. This is what makes deliverable C
   (video → 3D) seamless: the interactive viewer starts from the last `shot` of the video.
3. **Acceptance is a node.** A `Review` node produces an `approval` artifact. Export nodes
   require it. The lineage answers "who accepted what, when" without Frame.io.
4. **Every deliverable is embeddable.** Video ads, `.glb`, the reveal and the widget all export a
   copy-paste embed and a bundle, with a poster and an LCP budget. Static images are a by-product.
5. **Measured, not guessed.** The twin carries real dimensions (from a known-size reference or
   the CAD). "Scale & dimensions" callouts, AR placement and packshot framing use them.
6. **Fast path for merchants with photos only.** Reconstruct → twin check → fix in minutes; the
   same graph works when a CAD file arrives later (swap the input, everything downstream re-runs).

## 4. Node catalogue

Legend: `*` required input. `anyIn` means the generic extra ports (image/text/video/model3d)
shown on every node, as in the Flows UI. Engines are named by role; in the demo they are mock
engines, in production they are harness tools (see HARNESS_INTEGRATION_CONTRACT.md).

### 4.1 Input

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Product photos** (exists: `reference`) | — | `image[]` | mask/background removal on/off | 1–12 photos. Detects front view and a known-size reference (coin, card, ruler) for scale. |
| **Product 3D import** (new) | — | `model3d` | up-axis, unit, part naming (auto/manual) | GLB/glTF/USDZ/OBJ/FBX/STEP. Produces the twin directly, skipping reconstruction. |
| **Brand kit** (new) | — | `brand` | logo, colours, fonts, safe-area rules, channel presets | Feeds plates, captions and export naming. One per workspace, referenced per project. |
| **Brief** (exists) | — | `text` | goal, audience, tone, key message, aspects, channels | Same as today; `channels` is new. |
| **Text / Comment** (exist) | — | `text` / — | — | Unchanged. |

### 4.2 Build the twin

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Reconstruct** (exists, extended) | `image[]*`, `text` | `model3d` | detail draft/standard/high, symmetry hint, scale source | Photo → mesh + PBR. Emits confidence per region so the check node can flag it. |
| **Twin check** (new) | `model3d*`, `image[]` | `model3d` (approved twin) + `report` | tolerance, must-match views | Renders the twin at the photo cameras, overlays silhouettes, reports scale/proportion errors and untextured areas. Blocks downstream until resolved or waived. This is the anti-"generic AI 3D" gate and the thing Adobe never needs because their input is CAD. |
| **Materials & variants** (new) | `model3d*`, `image` | `model3d[]` (one per variant) | per-slot colour/material, variant names from brief | Colour-ways, finishes, label swaps. Every variant keeps the same geometry and part ids. |
| **Parts & rig** (new) | `model3d*` | `model3d` (rigged) | part split (auto), pivots, exploded offsets, hinge/lid definitions | Needed for exploded views, unboxing, lid-opens, feature callouts that point to a part. |

### 4.3 Stage

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Scene** (exists, extended) | `model3d*`, `text`, `brand` | `scene` | background (studio/colour/gradient/HDRI/generated), ground plane, environment IBL + rotation + exposure, props | Adobe's ground plane / IBL / exposure controls live here. |
| **Camera set** (new) | `scene*` | `shot[]` | checklist: front, back, left, right, top, bottom, ¾ front L/R, ¾ back L/R, hero, macro; per-shot zoom, focal length, framing | Adobe's packshot checklist as a reusable artifact. `shot[]` feeds images, video keyframes and the interactive viewer's preset cameras. |
| **Lighting** (new, optional) | `scene*` | `scene` | three-point / softbox / dramatic / product-on-white; lighting seed | Lighting seed makes variations repeatable (Adobe idea). |

### 4.4 Motion

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Animation** (exists, extended) | `scene*`, `shot[]`, `model3d` (rigged) | `clip` (video) + `motion` (keyframes) | preset: turntable / hero orbit / exploded / unbox / lid-open / feature-callout / scale-in; duration; easing; loop | Emits both a rendered clip and the **camera + part keyframes** (`motion`) so the interactive viewer can replay the same move. |
| **Camera path** (new) | `scene*`, `shot[]*` | `motion` | ordered shots, hold times, transitions | Keyframe editor between shots; used by Animation and by the reveal. |
| **Callouts** (new) | `scene*`, `text*`, `model3d` (rigged) | `overlay` | anchor to part, style from brand kit, timing | Feature labels that stay attached to a part in video and in the interactive viewer. |

### 4.5 Generate (AI)

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Composite in environment** (new; Adobe's Composite Imagery) | `scene*` or `shot*`, `text*` | `image[]` | content type (lifestyle/studio/seasonal), variations, seed, lighting seed, auto ground plane | Product pixels come from the render; the environment is generated around it, so the product never hallucinates. |
| **Structure-locked video** (new) | `motion*`, `scene*`, `text` | `video` | style, duration, strength | Video generation conditioned on the rendered clip (depth/structure), like Firefly's structure reference but for video. Keeps the product silhouette identical frame to frame. |
| **Image gen / Image edit / Upscale / TTS** (exist) | as today | as today | — | Generic media nodes stay for hooks, plates, voice-over. |

### 4.6 Package

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Ad variants** (exists, extended) | `clip` or `video`, `image`, `text`, `brand`, `overlay`, `audio` | `ad[]` | aspects (1:1, 4:5, 9:16, 16:9), channel presets (Meta, TikTok, YouTube, retail), hook/CTA timing, caption style, safe areas | Produces one ad per aspect × channel with specs checked (length, size, safe area). |
| **Interactive 3D** (new) | `model3d*` (approved), `shot[]`, `motion`, `scene` | `bundle3d` | target: web / Google 3D / Meta 3D / Shopify / AR; draco+ktx2, texture budget, LOD, poster shot, preset cameras, idle animation | Optimised `.glb` (+ `.usdz`), poster, and a `<model-viewer>`-compatible embed. Validated against each target's limits. |
| **Video → 3D reveal** (new) | `ad*` or `clip*`, `bundle3d*`, `motion` | `embed` | handoff mode: at end / on tap / on scroll; continuity: match last frame pose; fallback; autoplay policy | See section 5. The signature deliverable. |
| **Web widget** (new) | `bundle3d*`, `motion`, `brand` | `embed` | trigger: hover / scroll / autoplay-loop; size; lazy-load; LCP budget; theme | Replaces a static product image on any site with one `<script>` tag. See section 6. |
| **Caption & voice** (extend TTS + Text) | `text`, `audio` | `overlay` | — | Subtitles and VO tracks for Ad variants. |

### 4.7 Control

| Node | Inputs | Output | Settings | Notes |
| --- | --- | --- | --- | --- |
| **Review** (exists, extended) | `image[]`, `video`, `scene`, `model3d`, `bundle3d`, `embed` | `approval` | reviewers, required count, comment threads, side-by-side compare | Accepts a *set* (e.g. the 4 aspects) in one decision. Comments anchor to a frame or a 3D point. |
| **Compare** (new) | any two of the same type | `report` | metric: silhouette diff, colour diff, pose diff | Twin vs photo, v2 vs v1, video frame vs interactive pose. Used by Twin check and by the reveal continuity check. |
| **Export** (exists, extended) | `approval*`, anything exportable | `delivery` | presets: PNG pack, MP4 pack, GLB/USDZ bundle, reveal embed, widget embed, scene JSON | One delivery = zip + manifest + embed snippets + per-channel specs report. |

### 4.8 New port and artifact types

Port types today: `image, text, video, model3d, scene, audio, approval`.
Add: `shot` (camera+light+framing), `motion` (keyframes for camera and parts), `overlay`
(callouts/captions), `brand`, `bundle3d` (optimised interactive asset), `embed` (self-contained
web deliverable), `report`, `delivery`.

Artifact kinds to add: `glb-bundle`, `embed`, `motion`, `report`. All carry `twinId`,
`twinRevision`, `sceneRevision` and `approvalId` for lineage.

## 5. The "video → 3D reveal" deliverable

Goal: the viewer watches a 4–8 s ad; when it ends (or on tap/scroll), the product they just saw is
in their hands as an interactive 3D object, without a visual jump.

Mechanics:

1. The Animation node's `motion` artifact ends at a known `shot` (camera pose, exposure, background).
2. The Interactive 3D bundle is exported with that `shot` as its initial camera and the same
   scene background colour/HDRI rotation.
3. The Reveal node renders the final video frame from the bundle (not from the video) and runs the
   Compare node: pose and silhouette must match the video's last frame within tolerance,
   otherwise the node reports a continuity error and refuses to export.
4. The embed: poster → `<video>` (muted autoplay, inline) → on `ended`/tap/scroll, cross-fade to
   the viewer while the viewer is already warmed up (GLB fetched during playback, first frame
   rendered off-screen). Reduced-motion users get poster → viewer directly.
5. Fallback chain: WebGL missing → the video loops with the "rotate" affordance hidden; JS
   blocked → poster + video only.
6. Budgets: bundle ≤ 3 MB (draco + ktx2), poster ≤ 60 KB, script ≤ 40 KB gzip, no layout shift
   (fixed aspect box), LCP driven by the poster.

Why customers want it: the ad earns attention, the 3D object earns confidence. Today they have to
buy the two from different vendors and the two objects never quite match. Here the video and the
model are the same twin at the same revision by construction.

## 6. The "living portfolio" deliverable

Goal: replace the static product photo on a brand or agency site with a 3D object that moves.

- One `<script src=…widget.js data-annie3d="…">` tag or an `<iframe>`; the widget renders the
  poster immediately, loads the bundle lazily when near the viewport, then plays the chosen
  `motion` (idle loop, hover orbit, scroll-driven turntable).
- Uses the same optimised bundle as the reveal, so an agency can deliver A/B/C/D from one graph.
- Widget settings: trigger, size, theme (from brand kit), interaction on/off, AR button, analytics
  hooks (view, interact, AR-open).
- Budget: same as the reveal; a page with six widgets must stay under 20 MB total and must not
  render more than one WebGL context at a time (widgets share a context or pause when off-screen).

## 7. Differentiation summary

| Need | ElevenLabs Flows | Adobe digital twins | Annie 3D (this design) |
| --- | --- | --- | --- |
| Start from photos only | image nodes, no twin | requires a twin (CAD) | Reconstruct + Twin check gate |
| Guarantee the same object across outputs | no | yes (within its templates) | yes, across ads, `.glb`, reveal, widget (twinId/revision on every artifact) |
| Packshot camera checklist | no | yes | yes (Camera set → reusable `shot[]`) |
| Spin/turntable video | via generic video gen | yes | yes, plus exploded/unbox/callout presets from part rig |
| Composite in generated environment | prompt-only | yes | yes (product pixels rendered, environment generated) |
| Ad packaging per channel (aspects, safe areas, hooks) | no | no | Ad variants + Brand kit + spec check |
| `.glb`/`.usdz` interactive deliverable | no | no | Interactive 3D bundle validated per target |
| Video → interactive 3D with pose continuity | no | no | Reveal node with continuity check |
| Website widget replacing photos | no | no | Web widget embed |
| Acceptance inside the graph | no | Frame.io outside | Review → approval required by Export |
| Real dimensions on the twin | no | from CAD | from reference object or CAD; used by callouts and AR |
| Accessible to SMB | yes | enterprise only | yes |

## 8. Templates rebuilt on the catalogue

| Template | Graph |
| --- | --- |
| Turntable hero (video + reveal) | Photos → Reconstruct → Twin check → Scene → Camera set → Animation(turntable) → Ad variants → Review → Export(MP4 pack) and Interactive 3D → Reveal → Export(embed) |
| Feature callouts | … → Parts & rig → Callouts → Animation(feature-callout) → Ad variants → Review → Export |
| Colour variants | … → Materials & variants → Camera set → Composite in environment → Ad variants (carousel) → Review → Export(PNG pack + GLB per variant) |
| Portfolio refresh | Product 3D import (or Reconstruct) → Twin check → Scene → Animation(idle) → Interactive 3D → Web widget → Review → Export(embed ×N) |
| Scale & dimensions | … → Twin check (scale from reference) → Callouts(dimensions) → Animation(scale-in) → Ad variants → Review → Export |
| Unboxing reveal | … → Parts & rig (lid/box) → Animation(unbox) → Structure-locked video (styled) → Ad variants → Review → Export |

## 9. Current implementation and migration

Exists in the demo (`packages/contracts/src/workflow.ts`): reference, brief, text, comment,
image-gen, image-edit, image-upscale, video-gen, tts, reconstruct, scene, animation, ad-variants,
review, export; port types image/text/video/model3d/scene/audio/approval; the Flows canvas with
typed ports, palette, context menus, footer menu, run engine with lineage and acceptance.

Migration in order of customer value, each step keeping the demo green:

1. Contracts: add port types `shot`, `motion`, `bundle3d`, `embed`, `brand`, `overlay`, `report`,
   `delivery`; add node kinds `import3d`, `twin-check`, `materials`, `parts-rig`, `camera-set`,
   `composite-env`, `interactive-3d`, `reveal`, `web-widget`, `compare`, `brand-kit`; extend
   `animation`, `ad-variants`, `review`, `export` settings. Update `checkConnection`.
2. Mock engines: camera-set renders the checklist from the procedural fixtures with the existing
   viewer (`renderToImageData` per shot); interactive-3d exports a real `.glb` from the fixture
   scene with three's GLTFExporter plus poster; reveal produces a self-contained HTML embed that
   plays the sample MP4 and hands over to the viewer at the last shot; web-widget produces the
   same embed in widget mode. Twin check and compare use silhouette IoU on rendered masks.
3. UI: node settings panels for the new kinds; a "Deliverables" section on the Outputs tab
   grouped by class A–D with embed snippets and validation results; template catalogue rebuilt
   as in section 8.
4. Tests: J-journeys for each deliverable class, including loading the exported embed in a fresh
   page and verifying the video → 3D handoff and the continuity check.

## 10. Questions for the founder

1. Which deliverable class ships first in the demo: C (reveal) as the signature, or B (`.glb`)
   because it is the shortest path to a real file customers can use today?
2. Twin check strictness: block export on failed silhouette match, or warn and allow a waiver
   with a recorded reason?
3. Brand kit scope for v1: logo + colours + fonts only, or also channel presets and safe areas?
4. Do we host embeds (CDN + analytics) or only export self-contained files in v1?
