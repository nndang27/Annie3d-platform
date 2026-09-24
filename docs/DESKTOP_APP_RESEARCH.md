# Desktop app: research and proposal (2026-09-25)

Status: research only, nothing built. Requested: a desktop app that stays 1:1 with the website
automatically, shows "Relaunch to update" when the shell updates, opens `.annie3d` files, and a
business flow of 1 free run per day on the web, then subscribe or use the app with the user's own
AI account.

## What other AI and design apps are built with

| App | Shell | Web content | Shell updates |
| --- | --- | --- | --- |
| Claude desktop | Electron 44.4.3 (verified locally on v2.7032.0) | Remote: local title bar + claude.ai in `WebContentsView` (verified from the app's own `index.html` comment) | Squirrel.framework; "Relaunch to update" |
| ChatGPT (Windows 2024) | Electron wrapper of the site | Remote | Store / updater |
| ChatGPT macOS | Classic app was native (AppKit); since 2026-07 the new app is the Electron Codex app | Bundled (unverified) | unverified |
| Codex app (2026) | Electron over the Codex CLI | Bundled (app.asar) | Sparkle (macOS) |
| Perplexity | Native Mac app; Windows app exists | unverified | unverified |
| Cursor / VS Code | Electron | Bundled | Built-in updater, "restart to update" |
| Figma | Electron (BrowserView) | Remote | In-app update prompt |
| Notion, Linear | Electron wrapper of the web client | Web features without app updates (Notion) | App versioning |
| Slack | Electron | Hybrid: most code loaded remotely | unverified |
| draw.io | Electron | Fully bundled (CSP forbids remote JS) | Checks GitHub releases |

Sources: dbreunig.com (Claude is Electron), windowslatest.com (Claude and ChatGPT wrappers),
mjtsai.com and Wikipedia (Codex/ChatGPT app), macrumors.com (Perplexity), figma.com blog
(BrowserView), slack.engineering (hybrid Electron), github.com/jgraph/drawio-desktop,
electronjs.org docs (updates, autoUpdater, security), v2.tauri.app docs (updater, webview
versions, file associations, deep links), developer.chrome.com (File Handling API).

## Options for Annie 3D

| Option | 1:1 with web | Rendering | Size | Notes |
| --- | --- | --- | --- | --- |
| **Electron shell loading the live site** | Automatic: every deploy is in the app on next load | Same Chromium as Chrome (WebGL/three.js identical) | ~100 MB | What Claude, Slack, Figma do. Needs code signing (Apple Developer ID + notarization, Windows certificate) for auto-update |
| Tauri 2 shell loading the live site | Automatic | WKWebView on macOS (Safari engine, updated with macOS), WebKitGTK on Linux | ~10 MB | Smaller, but rendering differs from Chrome on Mac/Linux |
| Bundled SPA in the app | Needs an app release per web change | Either | — | Breaks the "automatic 1:1" goal |
| Installable PWA | Automatic | The user's browser | 0 | Chrome/Edge only for `.annie3d` double-click (`file_handlers` + `launchQueue`); no custom URL scheme; Safari/Firefox limited |

## Proposal

1. **Electron (electron-builder) shell that loads `https://<site>/`** with a thin, versioned
   preload bridge `window.annieDesktop` (open file, save file, app version, update state,
   secure key storage). The web code feature-detects the bridge, so there is no app-only UI code
   and every web deploy reaches the app immediately.
2. **Update button like Claude:** electron-updater checks a static feed on R2; on
   `update-downloaded` the shell tells the page, which shows "Relaunch to update vX"; clicking it
   calls `quitAndInstall()`. The web part never needs an app update.
3. **`.annie3d` files** (already built on the web, 2026-09-25): electron-builder
   `fileAssociations` (+ exported UTI on macOS, NSIS per-machine or MSI on Windows); the shell
   receives the path (`open-file` on macOS, second-instance argv on Windows) and hands the bytes
   to the page, which runs the same import as the web "Open board file". Add a PWA manifest with
   `file_handlers` as a cheap interim for Chrome/Edge users.
4. **"Open in app" from the website:** register `annie3d://`; a page cannot detect whether the
   app is installed, so the button tries the link and falls back to "Download the app".
5. **Offline:** a local "You are offline" page in the shell; boards need the server anyway.

## Business flow: 1 free run per day, then subscribe or bring your own AI

The web part is straightforward: a daily free-run allowance per account (and per device for
guests, with abuse limits), then the existing credits/checkout. The "use your own ChatGPT or
Claude account in our app" part has policy limits:

- **Anthropic does not allow it.** From Claude Code's legal page: "Anthropic does not permit
  third-party developers to offer Claude.ai login into their own applications, or to route
  requests through Free, Pro, or Max plan credentials on behalf of their users." Products,
  including those built on the Agent SDK, must use API keys. The only exception is shipping the
  unmodified Claude Code binary where each user signs in to their own plan, under Anthropic's
  Commercial Terms. Enforcement against third-party tools was reported in 2026.
- **OpenAI: possible but not contractual.** Codex supports "Sign in with ChatGPT", and the Codex
  app-server runs that flow for partners that embed Codex (JetBrains, Xcode). OpenAI staff have
  endorsed third-party coding harnesses using ChatGPT plans, but a general "Sign in with ChatGPT
  for third-party apps" request was closed without being adopted. Get written confirmation before
  building a business on it.
- **Compliant path:** bring-your-own **API key** (OpenAI / Anthropic / fal / Replicate), stored
  in the OS keychain by the desktop shell (or encrypted server-side on the web), billed to the
  user by the provider. This also works on the web, so the app is not required for it.

Recommended: 1 free run/day on the web → subscription, or BYOK (API key) on web and app. Keep
"sign in with ChatGPT" as an experiment only through OpenAI's Codex app-server with written
approval; do not offer Claude.ai login.

Sources: code.claude.com/docs/en/legal-and-compliance; gigazine.net (2026-02-20 block report);
learn.chatgpt.com/docs/auth; github.com/openai/codex app-server README and issue #10974;
blog.jetbrains.com (Codex in JetBrains IDEs); openai.com (apps in ChatGPT); ai-flow.net/byok.
