import {
  type AssetDto,
  CreateShareRequest,
  type NodeKind,
  type PublicShareResponse,
  type ShareDto,
} from '@annie3d/contracts';
import { assetVariants, boards, nodeVersionOutputs, shares } from '@annie3d/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { assetDto, bucketOf } from '../services/assets';
import { loadBoard } from '../services/boards';
import { downloadName, streamObject } from './assets';

export const shareRoutes = new Hono<AppEnv>();
type Db = ReturnType<typeof getDb>;
type ShareRow = typeof shares.$inferSelect;

/** 128-bit random token, base64url (22 chars): unguessable, fits `shares_token_chk`. */
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const origin = (c: Context<AppEnv>) => new URL(c.req.url).origin;

function shareDto(c: Context<AppEnv>, s: ShareRow): z.infer<typeof ShareDto> {
  return {
    id: s.id,
    token: s.token,
    url: `${origin(c)}/s/${s.token}`,
    targetType: s.targetType as 'board',
    targetId: s.targetId,
    visibility: s.visibility as 'unlisted',
    viewCount: s.viewCount,
    createdAt: s.createdAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
  };
}

shareRoutes.post('/api/shares', requireEditor, async (c) => {
  const req = await body(c, CreateShareRequest);
  const db = getDb(c);
  const ws = c.get('workspaceId')!;
  let boardId: string;
  if (req.targetType === 'board') {
    boardId = (await loadBoard(db, ws, req.targetId)).id;
  } else {
    const v = await db.query.nodeVersions.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, req.targetId), eq(t.workspaceId, ws)),
    });
    if (!v) throw httpError(404, 'not_found', 'Version not found');
    boardId = v.boardId;
  }
  // One live link per target: sharing again returns the existing link (no link sprawl).
  const existing = await db.query.shares.findFirst({
    where: (t, { and, eq, isNull }) =>
      and(eq(t.workspaceId, ws), eq(t.targetId, req.targetId), isNull(t.revokedAt)),
  });
  if (existing) return c.json(shareDto(c, existing));
  const [row] = await db
    .insert(shares)
    .values({
      workspaceId: ws,
      boardId,
      targetType: req.targetType,
      targetId: req.targetId,
      token: newToken(),
      visibility: req.visibility,
      createdBy: c.get('user')!.id,
    })
    .returning();
  return c.json(shareDto(c, row!), 201);
});

shareRoutes.get('/api/shares', requireUser, async (c) => {
  const boardId = c.req.query('boardId');
  const db = getDb(c);
  const rows = await db.query.shares.findMany({
    where: (t, { and, eq, isNull }) =>
      and(
        eq(t.workspaceId, c.get('workspaceId')!),
        isNull(t.revokedAt),
        boardId ? eq(t.boardId, boardId) : undefined,
      ),
    orderBy: (t, { desc }) => desc(t.createdAt),
    limit: 50,
  });
  return c.json({ shares: rows.map((s) => shareDto(c, s)) });
});

shareRoutes.delete('/api/shares/:shareId', requireEditor, async (c) => {
  const id = uuidParam(c, 'shareId');
  const res = await getDb(c)
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(and(eq(shares.id, id), eq(shares.workspaceId, c.get('workspaceId')!), isNull(shares.revokedAt)))
    .returning({ id: shares.id });
  if (!res.length) throw httpError(404, 'not_found', 'Share not found');
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ public side
/** Kinds shown on a shared board, in showcase order (hero video first). */
const SHOWCASE: NodeKind[] = ['adVideo', 'packshot', 'stage', 'model3d', 'upload3d', 'photo'];

interface Resolved {
  share: ShareRow;
  title: string;
  ownerName: string;
  /** Asset ids by showcase order; the only assets this token may serve. */
  items: { assetId: string; kind: NodeKind }[];
}

async function resolveShare(db: Db, token: string): Promise<Resolved | null> {
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(token)) return null;
  const share = await db.query.shares.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.token, token), isNull(t.revokedAt)),
  });
  if (!share) return null;
  const [b] = await db
    .select({ title: boards.title, archivedAt: boards.archivedAt })
    .from(boards)
    .where(eq(boards.id, share.boardId));
  if (!b || b.archivedAt) return null;
  const owner = share.createdBy
    ? await db.query.users.findFirst({
        where: (t, { eq }) => eq(t.id, share.createdBy!),
        columns: { name: true },
      })
    : null;
  let rows: { versionId: string; kind: NodeKind; y: number }[];
  if (share.targetType === 'version') {
    const v = await db.query.nodeVersions.findFirst({ where: (t, { eq }) => eq(t.id, share.targetId) });
    const n = v ? await db.query.boardNodes.findFirst({ where: (t, { eq }) => eq(t.id, v.nodeId) }) : null;
    rows = v && n ? [{ versionId: v.id, kind: n.kind as NodeKind, y: 0 }] : [];
  } else {
    const nodes = await db.query.boardNodes.findMany({
      where: (t, { and, eq, isNull, isNotNull }) =>
        and(eq(t.boardId, share.boardId), isNull(t.deletedAt), isNotNull(t.currentVersionId)),
      columns: { kind: true, currentVersionId: true, y: true },
    });
    rows = nodes
      .filter((n) => SHOWCASE.includes(n.kind as NodeKind))
      .map((n) => ({ versionId: n.currentVersionId!, kind: n.kind as NodeKind, y: n.y }));
  }
  const outs = rows.length
    ? await db
        .select()
        .from(nodeVersionOutputs)
        .where(
          inArray(
            nodeVersionOutputs.versionId,
            rows.map((r) => r.versionId),
          ),
        )
    : [];
  const items = rows
    .sort((a, b) => SHOWCASE.indexOf(a.kind) - SHOWCASE.indexOf(b.kind) || a.y - b.y)
    .flatMap((r) =>
      outs
        .filter((o) => o.versionId === r.versionId)
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ assetId: o.assetId, kind: r.kind })),
    );
  const seen = new Set<string>();
  return {
    share,
    title: b.title,
    ownerName: owner?.name ?? 'Annie 3D user',
    items: items
      .filter((i) => {
        if (seen.has(i.assetId)) return false;
        seen.add(i.assetId);
        return true;
      })
      .slice(0, 40),
  };
}

async function publicAssets(c: Context<AppEnv>, db: Db, r: Resolved): Promise<AssetDto[]> {
  const ids = r.items.map((i) => i.assetId);
  if (!ids.length) return [];
  const [rows, variants] = await Promise.all([
    db.query.assets.findMany({ where: (t, { inArray }) => inArray(t.id, ids) }),
    db.select().from(assetVariants).where(inArray(assetVariants.assetId, ids)),
  ]);
  const byId = new Map(rows.map((a) => [a.id, a]));
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => !!a && a.status === 'ready')
    .map((a) => assetDto(c.env, a, variants, `/api/public/shares/${r.share.token}/assets`));
}

shareRoutes.get('/api/public/shares/:token', async (c) => {
  const db = getDb(c);
  const r = await resolveShare(db, c.req.param('token'));
  if (!r) throw httpError(404, 'not_found', 'This link is not available');
  // Awaited, not waitUntil: closeDb ends the connection in waitUntil and could cut this off.
  await db.execute(sql`UPDATE shares SET view_count = view_count + 1 WHERE id = ${r.share.id}`);
  const res: z.infer<typeof PublicShareResponse> = {
    title: r.title,
    targetType: r.share.targetType as 'board',
    assets: await publicAssets(c, db, r),
    ownerName: r.ownerName,
  };
  c.header('cache-control', 'public, max-age=60');
  return c.json(res);
});

/** Files of a share: only assets in the shared target; revocation takes effect within 5 min. */
shareRoutes.get('/api/public/shares/:token/assets/:assetId/content', async (c) => {
  const db = getDb(c);
  const r = await resolveShare(db, c.req.param('token'));
  const assetId = uuidParam(c, 'assetId');
  if (!r?.items.some((i) => i.assetId === assetId)) throw httpError(404, 'not_found', 'Not found');
  const a = await db.query.assets.findFirst({ where: (t, { eq }) => eq(t.id, assetId) });
  if (a?.status !== 'ready') throw httpError(404, 'not_found', 'Not found');
  let key = a.storageKey;
  let mime = a.mime;
  const variant = c.req.query('variant');
  if (variant) {
    const [v] = await db
      .select()
      .from(assetVariants)
      .where(and(eq(assetVariants.assetId, assetId), eq(assetVariants.variant, variant)));
    if (!v) throw httpError(404, 'not_found', 'Not found');
    key = v.storageKey;
    mime = v.mime;
  }
  return streamObject(
    c.req.raw,
    bucketOf(c.env, a.bucket),
    key,
    mime,
    'public, max-age=300',
    downloadName(c.req.query('download')),
  );
});

// ------------------------------------------------------------------ share page (SSR + Open Graph)
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );

/**
 * F10 share page: server-rendered so link previews (Slack, iMessage, X, LinkedIn) read the
 * Open Graph tags without running JavaScript. No scripts; video autoplays muted.
 */
shareRoutes.get('/s/:token', async (c) => {
  const db = getDb(c);
  const r = await resolveShare(db, c.req.param('token'));
  const base = origin(c);
  if (!r) {
    return c.html(
      page(
        base,
        'Link not available',
        '<main class="empty"><h1>This link is not available</h1><p>It may have been revoked by its owner.</p><a class="cta" href="/">Open Annie 3D</a></main>',
        '',
      ),
      404,
    );
  }
  // Awaited, not waitUntil: closeDb ends the connection in waitUntil and could cut this off.
  await db.execute(sql`UPDATE shares SET view_count = view_count + 1 WHERE id = ${r.share.id}`);
  const assets = await publicAssets(c, db, r);
  const abs = (u: string | null | undefined) => (u ? (u.startsWith('http') ? u : `${base}${u}`) : '');
  const video = assets.find((a) => a.kind === 'video');
  const images = assets.filter((a) => a.kind === 'image');
  const model = assets.find((a) => a.kind === 'model3d');
  const ogImage = abs(
    video?.urls.poster ?? images[0]?.urls.poster ?? model?.urls.poster ?? images[0]?.urls.original,
  );
  const desc = `${r.ownerName} made this with Annie 3D: 3D product ads from one photo.`;
  const og =
    [
      ['og:type', video ? 'video.other' : 'website'],
      ['og:title', r.title],
      ['og:description', desc],
      ['og:url', `${base}/s/${r.share.token}`],
      ['og:site_name', 'Annie 3D'],
      ...(ogImage ? [['og:image', ogImage]] : []),
      ...(video?.urls.original
        ? [
            ['og:video', abs(video.urls.original)],
            ['og:video:type', 'video/mp4'],
          ]
        : []),
    ]
      .map(([p, v]) => `<meta property="${p}" content="${esc(v!)}">`)
      .join('\n') +
    `\n<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(r.title)}"><meta name="twitter:description" content="${esc(desc)}">${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}`;
  const body = `<header><a href="/" class="brand"><span class="mark">A</span> Annie 3D</a><a class="cta" href="/" data-testid="share-cta">Make yours free</a></header>
<main>
  <h1>${esc(r.title)}</h1>
  <p class="by">by ${esc(r.ownerName)}</p>
  ${video ? `<section class="hero"><video src="${esc(video.urls.original!)}" poster="${esc(video.urls.poster ?? '')}" autoplay muted loop playsinline controls preload="metadata" data-testid="share-video"></video></section>` : ''}
  ${
    images.length
      ? `<section class="grid" data-testid="share-images">${images
          .slice(0, 12)
          .map(
            (a) =>
              `<a href="${esc(a.urls.original!)}"><img src="${esc(a.urls.poster ?? a.urls.original!)}" alt="" loading="lazy" decoding="async" width="${a.width ?? 512}" height="${a.height ?? 512}"></a>`,
          )
          .join('')}</section>`
      : ''
  }
  ${model ? `<section class="model"><img src="${esc(model.urls.poster ?? '')}" alt="3D model preview" loading="lazy"><div><h2>3D model</h2><p>${model.triangleCount ? `${model.triangleCount.toLocaleString('en')} triangles · ` : ''}${(model.byteSize / 1048576).toFixed(1)} MB</p><a class="btn" href="${esc(model.urls.original!)}?download=model.glb">Download GLB</a></div></section>` : ''}
</main>
<footer>Made with <a href="/">Annie 3D</a> · <a href="/legal/terms">Terms</a></footer>`;
  c.header('cache-control', 'public, max-age=60');
  // No scripts on this page at all; media only from this origin.
  c.header(
    'content-security-policy',
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  return c.html(page(base, `${r.title} · Annie 3D`, body, og));
});

function page(_base: string, title: string, body: string, head: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">${head}
<style>
:root{color-scheme:light dark;--bg:#f6f6f4;--fg:#17191d;--muted:#6b6f76;--card:#fff;--line:#e4e4df}
@media (prefers-color-scheme:dark){:root{--bg:#121315;--fg:#f2f2f0;--muted:#9a9ea5;--card:#1b1c1f;--line:#2a2c30}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header,footer{display:flex;justify-content:space-between;align-items:center;max-width:1040px;margin:0 auto;padding:16px}
footer{color:var(--muted);font-size:13px;justify-content:center;gap:4px}footer a{color:inherit}
.brand{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-weight:600}.mark{width:24px;height:24px;border-radius:6px;background:var(--fg);color:var(--bg);display:grid;place-items:center;font-size:12px}
.cta,.btn{background:var(--fg);color:var(--bg);text-decoration:none;border-radius:10px;padding:9px 14px;font-weight:500;display:inline-block}
main{max-width:1040px;margin:0 auto;padding:0 16px 32px}h1{margin:8px 0 0;font-size:28px}.by{color:var(--muted);margin:4px 0 20px}
.hero{display:grid;place-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:16px}
.hero video{max-height:72vh;max-width:100%;border-radius:10px;aspect-ratio:9/16;background:#000}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px}.grid img{width:100%;height:auto;border-radius:12px;background:var(--card);display:block}
.model{display:flex;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}.model img{width:160px;height:160px;object-fit:contain;border-radius:10px}.model h2{margin:0 0 4px;font-size:18px}.model p{color:var(--muted);margin:0 0 10px}
.empty{text-align:center;padding:80px 16px}
@media (max-width:600px){.model{flex-direction:column;text-align:center}}
</style></head><body>${body}</body></html>`;
}
