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
- **Running.** A run (and the agent, 3D edits and exports) needs the board on the server. The
  first one uploads the current state as a **working copy**: a hidden board (`boards.expires_at`,
  migration 0006) that is not in any board list. The window then switches to it and runs work
  as usual. The next Save brings the results into the file; files the document already holds
  are copied from disk, not downloaded again.
- **Working copies expire.** Each run moves the expiry to 7 days later
  (`WORKING_COPY_TTL_DAYS`). A daily cron (`17 3 * * *`) deletes expired working copies and the
  files only they used, in the database and in R2. Files that another board also uses are kept,
  since the same bytes are stored once per workspace.
- **Sharing:** a board file is shared as the file.
- **Sign-in from a file window:** unsaved edits are kept in the shell across the page reload.
- **Older shells** (0.2.0) have no `docs` bridge: the page falls back to importing opened files
  into the current board.

Tests:
- `tests/desktop`: own window, Save writes back with byte-identical assets, the close prompt, a
  new file with Save As, a zip bomb, a 200 MB file by range.
- `tests/desktop-cloud` (real stack):
  1. The file opens in `file` mode.
  2. Run creates the working copy, which is not listed.
  3. The run finishes.
  4. Save puts the GLB into the file, and the photo is copied byte for byte.

  Run it with `node scripts/test-stack.mjs 5191 npx playwright test -c playwright.desktop-cloud.config.ts`.
- `tests/api/working-copies.test.ts`: hidden from lists; after expiry the working copy and its
  own file are deleted, and a file shared with another board stays.

## Not done yet

- **A run uploads the whole file, not only what it needs.** Duplicates are free on the server
  (content-addressed) but still travel over the network.
- **Classic ZIP only (no ZIP64).** The 2 GB limit comes from that.
- **The website still downloads a copy on ⌘S.** Writing back to the same file needs the File
  System Access API, which only Chrome and Edge have.
- **Windows and Linux file association** is configured but not yet tried on real machines.
