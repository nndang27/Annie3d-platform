# Board files (`.annie3d`) and local-first desktop boards

Code:
- Format: `packages/contracts/src/boardFile.ts` (manifest) and `zip.ts` (read/write, zip-bomb guard).
- Page: `apps/web/src/client/lib/boardFile.ts` (read, write, upload) and `lib/doc.ts` (desktop documents).
- Shell: `apps/desktop/src/main/docs.ts` (windows, serving from disk, streaming save).
- Server: `apps/web/src/worker/services/boardImport.ts`, `routes/boardFile.ts`, `services/cleanup.ts`.

## The format

A ZIP containing:
- `annie3d.json`: the manifest. It holds nodes, wires, prompts and settings, plus which file is
  each node's current result. It is deflated.
- `assets/<sha256>.<ext>`: each result stored as it is (media are already compressed), plus its
  poster, thumbnail and turntable (`assets/<sha256>-poster.webp`, …). Files are named by
  content, so a file used twice is stored once.

Container formats built the same way: `.sketch`, `.docx`/`.pptx` (OPC), `.3mf`, `.usdz`
(which is also a ZIP of stored files) and `.epub`. draw.io and Excalidraw work differently:
they embed images as base64 text (+33 %), which suits diagrams but not video or 3D.

Manifest version 2 (version 1 files still open):
- `stale` marks a node whose result is out of date.
- `sha256` gives a result's content hash.
- `bundle` stores an Export node's ZIP as its member list. On the example board that ZIP is a
  byte-for-byte copy of the GLB, MP4 and PNGs already in the file (3.2 of 8.3 MB). The ZIP is
  rebuilt when it is needed (download, upload) from the members, and it holds the same files
  byte for byte (each member is checked by SHA-256 when the bundle is recognised).

## Reading by range, not whole files (limit 2 GB, was 80 MB)

`readZipIndex` reads only the end of the file (the central directory), then each asset by its
offset. Where the bytes come from depends on the reader:
- **Browser:** `Blob.slice`. An asset becomes a slice of the File, so the browser leaves it on
  disk until it is shown.
- **Desktop shell:** a file handle. Assets are served to the page at `/__doc/<id>/<path>` with
  HTTP range support, so video can seek.
- **Worker:** R2 range reads.

Measured (desktop test, 2026-09-26): a 200 MB board file opens in 0.4 s. A range request
returns 206 with exactly the bytes asked for. The page's process stays at 152 MB, less than the
file's size.

**Uploads to the server:**
- Files up to 80 MB go in the request body (Workers accept bodies up to 100 MB).
- Larger files go to R2 in 16 MB parts through presigned multipart URLs. The Worker then
  imports them by range. Each asset streams into the content-addressed store and is hashed as
  it flows (DigestStream); an asset the workspace already has is skipped.

## Zip-bomb guard (zip.ts; same code in the browser, the shell and the Worker)

The guard checks before anything is read:
- **Assets must be stored (method 0).** A deflated asset is refused, so nothing in a board file
  can grow when it is read. Our own writers always stored media, so older files still pass.
- **The manifest is capped.** It may be deflated but is limited to 8 MB. It is inflated into a
  buffer of its declared size, then checked against its CRC-32.
- **Structure:**
  - Names must be `annie3d.json` or `assets/[A-Za-z0-9._-]+` (no `..` or absolute paths).
  - Duplicate names are refused.
  - At most 5000 entries, 2 GB in total.
  - Entries must lie inside the file, before the central directory.
  - No ZIP64, no encryption, no multi-part archives.
- **Checksums (server):** an asset whose bytes do not match the SHA-256 in its name is refused,
  and its object is deleted.

Tests:
- `packages/contracts/src/zip.test.ts`: a 10 MB deflated asset is refused; so are a manifest
  whose size is a lie, path tricks, duplicates and out-of-bounds entries.
- `tests/api/board-files.test.ts`: a 200 MB zip bomb is refused with a 400, and so is an asset
  whose name claims the wrong checksum.
- `tests/desktop`: a 300 MB bomb gets an error dialog and no window opens.

## Desktop: the file is the document (local-first)

- **One window per file** (`?doc=<id>`), like draw.io desktop or Sketch. Double-click, File >
  Open (⌘O) and File > New (⌘N) each open a window; a file that is already open comes to the
  front. The window title is the file's name, with the macOS proxy icon.
- **Opening sends nothing to the server.** Edits stay in memory:
  - The top bar shows **Edited**, and macOS shows the dot in the close button.
  - **Save** (⌘S) writes the file back. It streams a new file next to the old one, copying
    unchanged assets from the old file by range (only new results come from the page), then
    fsyncs it and renames it over the old one.
  - **Save As** is ⇧⌘S.
  - Closing with unsaved changes asks: Save, Don't Save or Cancel.
- **Running: only what the action reads is sent.** A run (and the agent, 3D edits, exports)
  needs the board on the server. The first one creates a **working copy**: a hidden board
  (`boards.expires_at`, migration 0006, in no board list) holding every node and wire (small
  JSON) but only the results that action reads:
  - a run reads its nodes (`runPlan`, the same function the server plans with) and their
    inputs;
  - an export reads the node and everything upstream;
  - a 3D edit reads the node;
  - the agent reads everything.

  The window then switches to the working copy. The other results stay on the canvas, shown
  from the file. When a later action reads one of them, it is sent first, added to the existing
  node (`/import?into=existing`). Sending results the file already holds is not an edit (the
  file stays **Saved**). The next Save brings new results into the file; files the document
  already holds are copied from disk, not downloaded again.
- **Working copies expire.** Each run moves the expiry to 7 days later
  (`WORKING_COPY_TTL_DAYS`). A daily cron (`17 3 * * *`) deletes expired working copies and the
  files only they used, in the database and in R2. Files that another board also uses are kept,
  since the same bytes are stored once per workspace.
- **Restart to update** opens the same windows again: each board file by its path, and the
  usual board if it was open. A file with unsaved changes asks first: Save saves it and the
  restart carries on; Cancel stops the restart.
- **Sharing:** a board file is shared as the file.
- **Sign-in from a file window:** unsaved edits are kept in the shell across the page reload.
- **Older shells** (0.2.0) have no `docs` bridge: the page falls back to importing opened files
  into the current board.

## Website: Chrome and Edge write the file back

Where the File System Access API exists (Chrome, Edge; `lib/webDoc.ts`), the website works
like the desktop app:
- **Open (⌘O)** picks a file and shows it in the tab without reloading. The URL becomes
  `/?file=<key>`, and Back returns to the board, which is already saved.
- **Save (⌘S)** writes the same file. The browser writes to a temporary file and swaps it in
  when the write closes. Unchanged assets are slices of the old file: nothing is read into
  memory.
- **Save As** is ⇧⌘S.
- **Unsaved changes:** the tab title starts with •, and leaving asks first.
- **Reloading:** the file handle is kept in IndexedDB, so a reload keeps the file. If the
  browser asks again, one click ("Open <name>") lets it read the file.
- **Runs** work as on the desktop, through a working copy.

It is not a new tab because the file picker uses up the click that would allow one.

Safari and Firefox do not implement the API: there ⌘S downloads a copy, and Open imports into
the board.

Measured: in Chrome driven by automation (Playwright/CDP), reading a file handle back from
IndexedDB closes the tab, even with a visible window. In a normal Chrome (no automation) the
same page read the handle after a reload, with permission kept (2026-09-26). The tests
therefore open files without a reload, and the reload path was checked in normal Chrome.

## Windows and Linux

The Desktop workflow (Actions → Desktop, on GitHub's macOS, Windows and Ubuntu machines)
installs the package the way a user would and asks the OS to open a `.annie3d` file
(`scripts/test-file-association.mjs`). The app reports the file it was handed:
- Windows: the NSIS installer (silent, per user), then `start`.
- Linux: the .deb, which installs the MIME type and the .desktop entry; `xdg-mime` must see
  `application/vnd.annie3d+zip` and pick `annie3d.desktop`, then `xdg-open`.
- macOS: the .app from the zip, registered with Launch Services, then `open`. macOS also gets
  a declared type (`app.annie3d.board`, a ZIP) instead of a dynamic one.

AppImage does not register file types (a limit of the format).

Tests:
- `tests/desktop`:
  - own window, and Save writes back with byte-identical assets;
  - the close prompt;
  - a new file with Save As;
  - a zip bomb;
  - a 200 MB file read by range;
  - Export bundles;
  - Restart to update reopens the files.
- `tests/desktop-cloud` (real stack):
  1. The file opens in `file` mode.
  2. Running one model creates the working copy (not listed) without the other branch's photo:
     it is on the canvas, not on the server.
  3. The run finishes.
  4. Save puts the GLB into the file, and the photos are copied byte for byte.
  5. Run all sends the other photo, and the file stays Saved.

  Run it with `node scripts/test-stack.mjs 5191 npx playwright test -c playwright.desktop-cloud.config.ts`.
- `tests/e2e/board-files.spec.ts` (Chromium): open in the tab, Edited and the title dot, Save
  writes the same file (a real browser file handle), the photo still shows after the file is
  replaced, Save As, and Back returns to the board.
- `tests/api/working-copies.test.ts`: hidden from lists; after expiry the working copy and its
  own file are deleted, and a file shared with another board stays.

## Not done yet

- **Classic ZIP only (no ZIP64).** The 2 GB limit comes from that.
- **The installer tests run on GitHub's virtual machines**, not on a physical Windows PC or
  Linux desktop.
