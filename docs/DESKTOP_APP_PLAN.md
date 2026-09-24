# Annie 3D desktop app (Electron): plan

Status: plan, nothing built yet (2026-09-25). Research: `docs/DESKTOP_APP_RESEARCH.md` and the
sources listed at the end.

## 1. What the big apps do, and what that means for us

| App | Web code in the app | Desktop-only work | Updates |
| --- | --- | --- | --- |
| Claude desktop | **Verified on this Mac (v2.7032.0, 2026-09-25):** Electron 44.4.3 / Chromium 152; the local `main_window/index.html` says "this is the html for app title bar and error UI. everything else gets loaded from claude.ai" (content shown in `WebContentsView`s) | Local title bar, Quick Entry and other small windows; bundled MCP servers and skills; `heavy-work-worker` and `file-index-worker` processes; V8 compile cache (`.jsc`) for fast start | Squirrel.framework (macOS), "Relaunch to update"; Windows moved Squirrel → MSIX in 2026 and could not migrate old installs |
| Figma | Same C++/WASM renderer as the web (WebGL, WebGPU since 2025-09 with fallback + blocklist) | Tabs as native views, bundled font helper (FigmaAgent) | Web always latest; desktop shell prompts to update |
| Discord | Two layers: **host** (shell) and **modules** (versioned, sha256), delta packages | Voice/native modules | Host and modules update separately |
| Slack | Hybrid: most code loaded remotely, treated as untrusted; preload is the only bridge | — | Shell updates |

**Is special desktop-only technique needed for performance?** Mostly no: Figma and Claude run the
same web code on desktop, and rendering speed is the same Chromium/WebGL. Desktop wins come from
things a browser tab cannot do:

1. **Local-first start:** the web build is served from disk (no download on launch), with V8 code
   cache: near-instant start and offline canvas.
2. **Unthrottled background work:** exports and renders keep running when the window is hidden
   (`backgroundThrottling: false` on a dedicated export window; offscreen rendering).
3. **Native processes for heavy media:** `utilityProcess` for zip/GLB parsing and, only where
   WebCodecs cannot (e.g. ProRes / alpha video), a bundled ffmpeg. Faster-than-realtime MP4 via
   WebCodecs + an MP4 muxer helps the website too, so it is a shared feature.
4. **Files and OS:** native open/save, `.annie3d` double-click, `annie3d://` links, no browser
   upload size ceiling, a large local asset cache (reopened boards show previews instantly).
5. **Keys in the OS keychain** for bring-your-own-API-key.

Not recommended: `ignore-gpu-blocklist` (crashes, visual bugs); copy Figma instead (runtime
fallback + our own blocklist). V8 heap stays capped at 4 GB per process, so heavy parsing moves to
workers/utility processes.

How this was verified: `/Applications/Claude.app` — `Contents/Frameworks` holds
`Electron Framework.framework` (44.4.3, `Chrome/152.0.7977.130`) and `Squirrel.framework`;
`Resources/app.asar` (47 MB, 362 files) holds the shell (`.vite/build`, 21 MB), six small local
windows (`.vite/renderer`, 5.7 MB), bundled MCP servers, and V8 compile caches; the main process
references `https://claude.ai` with `loadURL` and `WebContentsView`. So the chat UI is the website
itself, framed by a local title bar — the same shape proposed below, except that we serve the web
build from disk (signed, versioned) to get the per-deploy Update button and offline start.

## 2. Architecture: two update layers, one feature registry

```
┌──────────────────────── Electron shell (native, signed) ─────────────────────────┐
│ main process: windows, menus, updater, file association, deep links, keychain,   │
│               local asset cache, utilityProcess (zip/GLB/ffmpeg)                 │
│ preload: window.annieDesktop (versioned, typed bridge; the only door to Node)    │
└───────────────┬──────────────────────────────────────────────────────────────────┘
                │ serves from disk, verifies signature
┌───────────────▼──────── Web layer (same build as the website) ───────────────────┐
│ shared features (canvas, nodes, runs, simulator…)                                │
│ desktop-only UI (separate Vite entry, loaded only when window.annieDesktop)      │
└───────────────┬──────────────────────────────────────────────────────────────────┘
                │ /api/* and WebSockets go to the network as today
          Cloudflare Worker API (unchanged)
```

- **Layer W (web layer):** every website deploy also publishes a *signed web-pack manifest*
  (`{version, minShell, files: [{path, sha256, size, features}]}`) to R2. The app downloads
  only files whose sha256 it does not have (Vite file names are content-hashed, so a typical
  deploy is a few hundred KB, not the full 1.9 MB), stages them in `userData/web/<version>/`,
  and shows **"Update ready · Reload"**. Reload swaps the renderer to the new folder in under a
  second; the previous version is kept for automatic rollback if the new one does not report
  "ready" within 10 s (Capgo's pattern).
- **Layer S (shell):** native changes (Electron version, main/preload, ffmpeg, OS integration)
  ship through electron-updater (NSIS + blockmap deltas on Windows, zip differential on macOS)
  and show **"Relaunch to update"**. Rare.
- **Origin:** the shell intercepts `https://<our domain>/` for page and asset requests and serves
  them from the local pack, while `/api/*`, WebSockets and `/s/*` pass through to the network. The
  page keeps its real origin, so cookies, Google sign-in, CSP and same-origin APIs work unchanged.
  (Spike this first; fallback: `app://` scheme + CORS/cookie changes.)
- **Security:** web-pack manifest signed with Ed25519 in the deploy pipeline, public key built
  into the shell (OS code signing covers only the shell); `contextIsolation`, `sandbox`, no Node in
  the renderer, navigation allow-list, Electron fuses (ASAR integrity, only load app from ASAR).

### The two lists (feature registry)

`packages/contracts/src/features.ts`, one entry per feature:

```ts
{ id: 'canvas.clipboard', title: 'Copy/paste nodes', surface: 'shared', layer: 'web',
  paths: ['apps/web/src/client/canvas/clipboard.ts'] }
{ id: 'desktop.fileAssociation', title: 'Open .annie3d by double-click', surface: 'desktop',
  layer: 'shell', paths: ['apps/desktop/src/main/files/**'], minShell: '1.0.0' }
{ id: 'desktop.localCache', title: 'Offline previews', surface: 'desktop', layer: 'web+shell', … }
```

- **surface** `shared` (web + app) or `desktop` (app only). **layer** says where its code lives.
- Desktop-only UI is its own Vite entry/chunks (`apps/web/src/client/desktop/*`), loaded only in
  the app, so website visitors never download it and a desktop-only change touches only those
  files.
- **Update planner** (`scripts/desktop-plan.mjs`, run by deploy): diff the build against the last
  published manifest → list changed files → map them to features through `paths` → decide:
  - only shared or desktop-UI files changed → **web-pack update** (download only those files);
  - shell paths changed → **shell release** (electron-updater);
  - only Worker/API code changed → **no app update** (the API is remote).
  The button shows what changed and the size, e.g. "Update ready: Copy/paste nodes, Offline
  previews · 184 KB · Reload".
- **CI guard:** every file under `apps/web/src/client` and `apps/desktop/src` must belong to a
  feature (or `core`), so the lists never drift.
- **Compatibility:** `/api/public/config` returns `minWebPack`; an app below it must update before
  running. The API keeps accepting the previous web-pack version for 14 days.

## 3. Repository layout

```
apps/desktop/                  Electron shell (TypeScript, bundled with esbuild)
  src/main/{app,windows,protocol,updater,webpack,files,deeplink,keychain,cache}.ts
  src/preload/bridge.ts         window.annieDesktop (contextBridge)
  electron-builder.yml          dmg/zip (mac), NSIS (win), fileAssociations .annie3d, protocol annie3d
packages/desktop-bridge/       Types of window.annieDesktop shared by shell and web
apps/web/src/client/desktop/   Desktop-only UI (update pill, native export, cache settings)
scripts/desktop-plan.mjs       Update planner; scripts/desktop-publish.mjs signs + uploads packs
```

## 4. Phases

| Phase | Deliverable | Checks |
| --- | --- | --- |
| D0 spike (1 day) | Shell serves the local build on the real origin via interception; sign-in, runs (WebSocket), uploads, simulator work | Playwright `_electron` smoke test |
| D1 shell MVP | Window, bridge, single instance, menus, `.annie3d` open/save natively, `annie3d://` deep link | E2E in Electron |
| D2 web-pack updater | Signed manifest, hash diff download, staging, "Reload" pill, rollback, `minWebPack` | Fake-feed tests: diff size, tampered file rejected, rollback |
| D3 feature registry + planner + CI guard | Two lists, per-deploy plan, release notes in the pill | Unit tests on planner |
| D4 shell updates + signing | electron-builder, R2 feed, blockmaps, macOS notarization, Windows signing, stable/beta channels | Update from v1 → v2 on both OSes |
| D5 desktop performance | Local asset cache, export window (unthrottled, offscreen), WebCodecs MP4 (shared), utilityProcess parsing, keychain BYOK | `pnpm measure` + perf panel with `platform=desktop` in RUM |

## 5. Needs from the owner

- Apple Developer Program ($99/yr) for Developer ID signing + notarization (auto-update requires
  a signed app).
- Windows code signing: Azure Artifact Signing ($9.99/mo Basic) or a hardware-token certificate.
- Choose NSIS (self-updating, blockmap deltas) now; switching to MSIX later is what broke Claude's
  Windows updates.
- Linux: yes/no.

## Sources

electronjs.org docs (performance, security, protocol, utilityProcess, offscreen rendering, fuses,
ASAR integrity, code signing, V8 memory cage, release schedule); electron.build (NsisUpdater,
BaseUpdater, MSIX); github.com/electron/electron PR 52820 (Squirrel.Mac deltas); Squirrel.Windows
delta docs; docs.velopack.io; figma.com blog (BrowserView, WebGPU) and help center; Anthropic
engineering (Desktop Extensions); dbreunig.com (why Claude is Electron); anthropics/claude-code
issues 25162, 49699, 66075, 88586, 90867, 93008; third-party Claude desktop teardowns
(gist.github.com/JacquesGariepy, telkins.com; unverified); slack.engineering (hybrid Electron);
Wumpdle / reUpdater (Discord updater, reverse-engineered); capgo.app (live updates);
developer.chrome.com (WebGPU); azure.microsoft.com (Artifact Signing pricing); developer.apple.com
(notarization).
