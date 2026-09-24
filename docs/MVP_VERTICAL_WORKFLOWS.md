# MVP verticals and one-image auto-workflows

> Scope and feature list are consolidated in `MVP_STRATEGY.md` (2026-09-24); this document keeps the per-line node detail.

Status: proposal for founder review (2026-09-24). Supersedes the node catalogue in
`WORKFLOW_3D_DESIGN.md` for the first public release. Nothing here is implemented yet.
Numbers marked *initial* are starting thresholds to calibrate on the eval sets in section 7,
not measurements.

## 1. Positioning

Canva sells templates the user fills by hand. Annie 3D sells **production lines**: the user drops
one product photo, picks a line, and receives a finished 3D ad. No manual 3D editing.
Changes after the run go through region-select + chat (section 6).

Every line is a fixed graph. The user sees the nodes on the canvas and can watch them run,
but does not have to wire anything.

## 2. The three agent systems

| System | What it does | Best for |
| --- | --- | --- |
| **Code builder** | Looks at the image and writes the 3D model as code (parts + assembly). | Manufactured objects: electronics, packaging, furniture, toys, jewelry with regular geometry. Exact dimensions, clean part tree. |
| **Generative builder** | Drives a deep-learning image-to-3D model (Tripo, Meshy, Pixal3D…) and cleans the result. | Organic or soft objects: food, bread, clothing, filigree, plush. |
| **Scene director** | Materials, lighting, environment, placement, camera, motion, render. | Every line. |

A **Router** node chooses the builder from the intake classification. If the chosen builder
fails its quality gate twice, the Router tries the other builder once before the run fails.

## 3. Choosing the verticals

Criteria, each scored 1–3:

1. **Builder fit**: can the code builder produce it from one photo with correct proportions?
2. **3D pain**: do these sellers already pay for 3D/CGI ads?
3. **Signature motion**: is there one ad motif everyone in the vertical recognises?
4. **One image is enough**: can the unseen sides be inferred from category priors?
5. **Buyer can pay**: margin and ad budget per SKU.

| Vertical | Fit | Pain | Motif | One image | Pay | Total | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Consumer electronics and gadgets | 3 | 3 | 3 (teardown/explode) | 2 | 3 | **14** | Launch |
| Jewelry and watches | 3 | 3 | 3 (sparkle, stone, water) | 2 | 3 | **14** | Launch |
| Beauty, skincare, fragrance packaging | 3 | 3 | 3 (splash, podium) | 3 | 2 | **14** | Launch |
| Furniture and home decor | 3 | 2 | 2 (room placement) | 2 | 2 | 11 | Next |
| Toys and collectibles | 2 | 2 | 2 | 2 | 1 | 9 | Next |
| Food and bakery | 1 (generative only) | 2 | 3 (ingredients falling) | 2 | 1 | 9 | Later |
| Footwear and apparel | 1 (generative only) | 3 | 2 | 1 | 3 | 10 | Later |

Launch with three verticals. All three are code-builder-first, which is where our
quality is most controllable. The generative builder is still wired in as fallback and
for the jewelry filigree case.

## 4. Shared backbone (every line)

```
Photo ─▶ Intake ─▶ Router ─▶ Builder ─▶ Twin check ─▶ Materials ─▶ Rig ─▶ Scene ─▶ Motion ─▶ Render ─▶ Package
                                  ▲            │ fail (≤2 retries, then other builder once)
                                  └────────────┘
```

| Node | System | Input | Output | Automatic behaviour |
| --- | --- | --- | --- | --- |
| **Intake** | Director (vision) | 1 photo | product card: vertical, sub-type, mask, palette, visible text/logo boxes, front view, proportion estimates | Background removal; classify into the line's allowed sub-types; refuse with a clear message if the photo is out of vertical. |
| **Router** | rule | product card | builder choice | Sub-type table per line, no LLM call. |
| **Builder** | Code or Generative | photo + card | `model3d` with named parts | Unseen sides inferred from sub-type priors (symmetry, standard backs). |
| **Twin check** | rule | model + photo | pass/fail + report | Render at the solved camera; silhouette IoU vs mask ≥ 0.90 *initial*; aspect ratio error ≤ 3 % *initial*; no open or inverted faces. |
| **Materials** | Director | model + photo + palette | PBR per part | Sample colours from the photo; pick finish (matte, satin, gloss, metal, glass) per part from a vertical-specific list; labels and logos are projected from the photo, never re-generated as text. |
| **Rig** | rule on part tree | model | pivots, explode vectors, hinge axes | Line-specific (sections 5.x). |
| **Scene** | Director | model + line preset | scene | Environment built from a curated asset kit per line (section 8), placement by contact solver so the product rests, never floats unless the line says so. |
| **Motion** | Director | scene + rig + line timeline | keyframes | Fixed timeline per line; only duration and aspect change the timing. |
| **Render** | render service | scene + keyframes | frames | Browser preview in seconds (Three.js); final frames on the GPU renderer. |
| **Package** | rule | frames + model | deliverables | MP4 1:1, 4:5, 9:16; animated `.glb` with channel presets; 4 packshots; share link. |

### User controls (the only knobs)

- Look preset: three per line.
- Duration: 6 s, 10 s, 15 s.
- Aspects: any of 1:1, 4:5, 9:16, 16:9.
- Headline, CTA, logo upload.
- Music bed from a small licensed library, or none.

Everything else goes through region-select + chat after the run.

## 5. Launch lines

Three flagship lines at launch, one per vertical. The second line of each vertical ships
2–4 weeks later if the flagship passes its eval set.

### 5.1 Electronics — "Teardown reveal" (flagship)

The phone/earbuds/speaker/watch comes apart into layers, holds, then snaps back together.

- **Sub-types**: phone, tablet, earbuds + case, smartwatch, smart speaker, headphones,
  power bank, game controller.
- **Input**: one photo. Optional extra photos: back side, or one photo per component
  (the "N component nodes" mode) for a factually accurate teardown.
- **Builder**: Code builder, assembly first. The shell is split into the parts a real
  teardown shows: frame, display stack, back cover, camera module, buttons, ports.
- **Internals**: one photo cannot show the inside. Internals come from a parametric
  **generic internals kit** (battery, logic board, shields, speaker, camera stack,
  haptic motor, antenna flex) sized to the shell cavity. The ad carries a small
  "illustrative internals" note unless the user supplied component photos. This keeps
  us from implying a real product's internal design.
- **Rig**: explode vectors from the assembly's stacking axis (Z for phones and tablets,
  radial for earbuds cases and speakers); parts ordered outer to inner; stagger 60 ms
  per part; collision-free straight paths checked before render.
- **Timeline (10 s)**: 0–1.5 hero three-quarter, light sweep · 1.5–4 explode with camera
  dolly out and slight orbit · 4–6 hold, up to three callouts anchored to parts ·
  6–8 reassemble with a soft snap · 8–10 end card with headline + CTA.
- **Look presets**: Dark studio (rim light, black reflective floor), Light lab (white
  cyclorama, soft shadow), Brand colour (gradient from palette).
- **Gates**: assembled state has zero interpenetration; every part returns to its exact
  rest pose (transform delta = 0); no part leaves frame during explode.
- **Second line**: "Hero orbit + light sweep" (Apple-style 360 with three macro cuts on
  detected features).

### 5.2 Jewelry — "Stone & water" (flagship)

The piece rests on a wet stone plinth beside a thin waterfall; slow push-in, glints on the
stones, clean and luxurious.

- **Sub-types**: ring, pendant, earring pair, bracelet, watch.
- **Builder**: Code builder for regular pieces: band profile sweep, setting (prong,
  bezel, pavé, halo), gems from a **cut library** (round brilliant, oval, princess,
  emerald, cushion, pear, marquise). Generative builder for filigree, organic or
  engraved pieces.
- **Materials**: metal from photo colour (yellow, white, rose gold, silver, platinum);
  gem type from colour (diamond, sapphire, emerald, ruby, pearl, "coloured stone").
- **Scene**: procedural stone plinth (three shapes), **pre-simulated water loops**
  (sheet waterfall, droplets, ripple pool) from the asset kit, no live fluid simulation.
  Dark or warm-neutral backdrop, caustic light.
- **Timeline (10 s)**: 0–2 wide, water visible · 2–6 push-in and 30° orbit around the
  piece · 6–8 macro on the main stone with two timed glints · 8–10 end card.
- **Render**: gem refraction and dispersion need the path-traced final render; the
  browser preview uses an approximation and says so.
- **Gates**: gem count and arrangement match the photo; piece rests on the stone
  (contact, no float); no clipped highlights on metal beyond 1 % of product pixels *initial*.
- **Second line**: "Velvet turntable macro" (display bust or box, turntable, focus pulls).

### 5.3 Beauty and fragrance — "Splash hero" (flagship)

The bottle or jar rises through a liquid splash that matches the product colour, settles on a
podium, label facing camera.

- **Sub-types**: dropper bottle, pump bottle, perfume bottle, jar, tube, compact, lipstick.
- **Builder**: Code builder (revolve and loft profiles; caps and pumps from a parts
  library). The label is the photo, projected as a decal.
- **Scene**: podium set (round, stepped, arch), **pre-simulated splash caches** tinted to
  the palette, optional floating ingredients (petals, citrus slices, leaves) from the kit.
- **Timeline (10 s)**: 0–2 splash rises · 2–4 product emerges, liquid falls away ·
  4–7 slow orbit, label to camera · 7–10 end card.
- **Gates**: label legible at 1080 px (OCR on the rendered frame matches OCR on the
  photo); glass and liquid read as transparent; label faces camera at 7 s.
- **Second line**: "Podium & botanicals" (pastel podium, floating ingredients, slow orbit).

## 6. Region-select + chat editing

No manual mesh tools. The user selects an area on the 3D model (brush or polygon lasso)
and writes what to change.

| Change | Code-built model | Generative model |
| --- | --- | --- |
| Colour, material, finish | yes | yes |
| Swap logo / label | yes | yes |
| Scale or move a part | yes (edit the part's parameters) | only for separated parts |
| Change a shape feature (round a corner, add a hole) | yes (selection maps to faces → feature in code) | not at launch |
| Scene: light, backdrop, props | yes | yes |

Every edit creates a new version on the node, with before/after compare and one-click
revert. Shape edits on generative models stay out of launch until they pass a 20-case test.

## 7. Eval sets and "100 % automatic"

"100 % automatic" means no human touches a run that passes its gates. It does not mean every
photo succeeds. A run that fails its gates after retries stops, refunds the credit and tells
the user which gate failed and what photo would work better.

- **Eval set**: 30 real retailer photos per launch line (90 total), mixed angles,
  backgrounds and lighting.
- **Launch bar**: a line ships when ≥ 24/30 runs pass all gates with no human edit, and a
  blind review of the 24 by two people outside the team rates ≥ 20 as "would post this ad".
- **Regression**: the eval set re-runs on every model, prompt or asset-kit change.

## 8. Asset kits (the part that makes a line a "template")

| Line | Kit |
| --- | --- |
| Teardown reveal | generic internals kit (≈ 12 parametric parts), 3 studio environments, callout styles |
| Stone & water | 3 plinth shapes, 3 water loops, 2 backdrops, caustic light rigs, gem cut library (7 cuts) |
| Splash hero | 3 podiums, 4 splash caches, ingredient props (≈ 10), 3 backdrops |
| All | HDRIs (6), end-card layouts (3), licensed music beds (≈ 10), font pairs (3) |

The kits are finite, curated and versioned. Adding a line later means adding a kit and a
timeline, not new agents.

## 9. What the canvas shows

A line is a **starter graph**, not a locked pipeline. Choosing it from Starters ▾ places
ordinary nodes (Photo → 3D model → Stage → Ad video, plus Packshot and Export) already wired,
which the user can edit, rewire, extend or delete. The line-specific logic (asset kit, rig,
timeline, gates) is exposed as presets on the Stage and Ad video nodes, so the same presets
work in any graph the user builds by hand. The first full run is free after a one-tap
sign-in; the next run needs a plan.

## 10. Open decisions

1. Confirm the three launch verticals, or swap one for furniture.
2. Confirm "illustrative internals" labelling for single-photo teardowns.
3. Final render: own GPU renderer or a render service for the path-traced frames.
4. Music bed: include a licensed library at launch, or ship silent video first.
