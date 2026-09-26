# Design system (decided 2026-09-26)

One material for the whole app: a warm, matte Soft UI surface (neumorphism) with a single accent
colour. The tokens live in `apps/web/src/client/app.css` (`:root`); nothing in the app's chrome
uses a size, radius or colour outside them. Shared `@annie3d/ui` tokens are mapped onto these;
the marketing site keeps its own look for now.

## Why

A UI/UX review of the app (2026-09-25) found:
- 17 font sizes, 15 radii and 112 hex colours;
- five competing accents: a black Run all, indigo Run buttons, blue selection, a green "online"
  dot and an orange "Not signed in";
- three design languages on one screen: Soft UI nodes, flat white chrome and a flat editor;
- AI-template tells: a ✨ icon, "·" separators everywhere, floating white cards, the Tailwind
  slate + indigo palette, the system font, a green online dot, a centred grey chat placeholder
  and "cr" for credits.

## Tokens

| | Tokens |
| --- | --- |
| Type (6) | `--fs-xs` 11, `--fs-sm` 12, `--fs-md` 13, `--fs-base` 14, `--fs-lg` 16, `--fs-xl` 20 px |
| Radius (4 + round) | `--r-sm` 6, `--r-md` 10, `--r-lg` 16, `--r-xl` 22 px; 50% for circles |
| Font | Instrument Sans (variable, OFL), self-hosted via `@fontsource-variable/instrument-sans` (latin subsets on demand, `font-display: swap`) |
| Surface | `--surface` #ece9e4, `--surface-sunken` #e3dfd8, `--line`, `--line-strong` |
| Ink | `--ink` #24211e, `--ink-2` #544e47, `--ink-3` #655e56 |
| Accent (one) | `--accent` #c0441a, `--accent-hover`, `--accent-ink` (accent text), `--accent-soft`, `--accent-glow` |
| Status only | `--success`, `--warning`, `--danger` (+ `-soft`) |
| Depth (fixed chrome) | `--raised`, `--raised-sm`, `--pressed`, `--floating` |

The same tokens drive the 3D views. `uiColor()` in `packages/viewer-3d/src/theme.ts` reads the
editor background (`--surface-sunken`) and the selection and outline colour (`--accent`) from
CSS.

Measured after the change:
- chrome CSS: 6 font sizes, 4 radii, 0 colours outside the tokens;
- the ~27 colour values all sit in `:root`;
- 31 colours remain in the simulation mock-ups (`/* Content mock-ups */`: a shop page, a TikTok
  feed, a chat, a showroom). They imitate those places on purpose.

## Contrast (WCAG 2.2 AA, computed)

| Pair | Ratio |
| --- | --- |
| ink / ink-2 / ink-3 on surface | 13.2 / 6.8 / 5.3 : 1 |
| ink-3 on sunken | 4.8 : 1 |
| white on accent (buttons) | 5.1 : 1 |
| accent-ink on surface, on accent-soft | 6.6, 6.1 : 1 |
| accent as a focus ring or selection (non-text) | 4.3 : 1 |
| success / warning / danger on surface | 4.9 / 5.2 / 5.4 : 1 |
| wires on surface (non-text) | 3.1 : 1 |

## Rules

- **One accent means "primary or selected".** It is used for Run, Run all, send, the selected
  node, focus rings, the current tool and running wires. Status colours are used only for
  status.
- **Raised means pressable, sunken means input.**
  - Buttons are raised, or flat until hovered.
  - Inputs and wells are pressed in.
  - Information (the version and engine above a node) is plain text, never a raised chip.
- **Disabled looks unavailable**: flat, pale, no shadow. It is never a darker version of the
  primary button.
- **Board vs chrome depth.**
  - Chrome (bars, panels, menus, dialogs) uses CSS shadow tokens.
  - The board uses the baked sprites (`canvas/neu/*.webp`, re-baked for the warm surface).
  - `boardPaint.test.ts` fails on a blurred shadow, blur filter or gradient on board content,
    now including the shadow tokens.
- **Menus are popovers in screen space** (`chrome/Popover.tsx`, rendered into `<body>`):
  - Escape, a click outside or focus leaving closes them;
  - ↑ ↓ Home End move between items;
  - focus returns to the trigger;
  - they open above the button when the bottom toolbar is in the way.
- **Copy**: no "·" separators. A cost sits in its own part of the button ("Run all | 114
  credits"), and "credits" is always spelled out.
- **Kinds are shown by icon, not colour.** The toolbar, the palette, ports and wires use the
  node's icon. Wires are neutral, and the accent shows activity.
- **The agent panel starts closed.** "Ask Annie" opens it and the choice is remembered. Its
  suggestions sit above the input and fill it when clicked.
- **Developer tools stay out of the chrome**: the performance panel opens with ⌥P or `?perf`.

## Measured (same methods as the earlier restyle)

| | Before | After |
| --- | --- | --- |
| Cold zoom stalls (Chrome for Testing, cold GPU cache) | 3–4 (≤ 101 ms) | 1–2 (≤ 92 ms), 3 runs |
| Cold pointer-sweep stalls | 0–1 | 0–2 (the second at the first video playback, ~4 s) |
| 200 nodes pan / zoom | 116–120 / 117–120 fps | 116–119 / 117–120 fps |
| Board ready / images ready (local build, cold) | 110 / 150 ms | 111 / 157 ms |
