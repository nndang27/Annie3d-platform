// @vitest-environment node
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { gateName } from '../engines/simulator';
import type { AppEnv } from '../env';
import { page } from '../routes/shares';
import { exportGlb } from '../services/exporter';
import { errorResponse, httpError, unknownEndpoint } from './http';
import { localeOf, localized, translator } from './i18n';

/** A tiny app with the Worker's error handling (index.ts imports Durable Objects, not loadable here). */
function app() {
  const a = new Hono<AppEnv>();
  a.onError(errorResponse);
  a.notFound(unknownEndpoint);
  a.get('/api/boards/x', () => {
    throw httpError(404, 'not_found', 'api.board.notFound');
  });
  a.get('/api/param', () => {
    throw httpError(404, 'not_found', 'api.http.unknownParam', { name: 'boardId' });
  });
  a.get('/api/details', () => {
    throw httpError(409, 'conflict', 'api.run.alreadyRunning', { runId: 'r1' });
  });
  a.get('/api/boom', () => {
    throw new Error('db down');
  });
  return a;
}

const get = async (path: string, headers: Record<string, string> = {}) => {
  const res = await app().request(path, { headers });
  return { res, body: (await res.json()) as { error: { code: string; message: string; details?: unknown } } };
};

describe('worker i18n', () => {
  it('reads the language from the cookie, then Accept-Language, then English', () => {
    const req = (h: Record<string, string>) => new Request('http://x/', { headers: h });
    expect(localeOf(req({ cookie: 'a=1; annie3d_lang=vi' }))).toBe('vi');
    expect(localeOf(req({ 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' }))).toBe('fr');
    expect(localeOf(req({ cookie: 'annie3d_lang=ja', 'accept-language': 'fr' }))).toBe('ja');
    expect(localeOf(req({ cookie: 'annie3d_lang=xx', 'accept-language': 'pt-PT' }))).toBe('pt');
    expect(localeOf(req({ 'accept-language': 'de' }))).toBe('en');
    expect(localeOf(req({}))).toBe('en');
  });

  it('keeps English error text and the stable code', async () => {
    const { res, body } = await get('/api/boards/x');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-language')).toBe('en');
    expect(body.error).toMatchObject({ code: 'not_found', message: 'Board not found' });
    expect((await get('/api/param')).body.error.message).toBe('Unknown boardId');
    expect((await get('/api/details')).body.error).toMatchObject({
      code: 'conflict',
      message: 'A run is already in progress on this board',
      details: { runId: 'r1' },
    });
    const boom = await get('/api/boom');
    expect(boom.res.status).toBe(500);
    expect(boom.body.error.message).toBe('Something went wrong. Try again.');
    expect((await get('/api/nope')).body.error).toMatchObject({
      code: 'not_found',
      message: 'Unknown endpoint',
    });
  });

  it('translates errors with the vi catalog for cookie annie3d_lang=vi', async () => {
    const { res, body } = await get('/api/boards/x', { cookie: 'annie3d_lang=vi', 'accept-language': 'fr' });
    expect(res.headers.get('content-language')).toBe('vi');
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe(translator('vi')('api.board.notFound'));
    const missing = await get('/api/nope', { cookie: 'annie3d_lang=vi' });
    expect(missing.res.headers.get('content-language')).toBe('vi');
  });

  it('uses Accept-Language: fr without a cookie', async () => {
    const { res, body } = await get('/api/param', { 'accept-language': 'fr-FR,fr;q=0.9' });
    expect(res.headers.get('content-language')).toBe('fr');
    expect(body.error.message).toBe(translator('fr')('api.http.unknownParam', { name: 'boardId' }));
  });

  it('renders the share page in the visitor language', () => {
    expect(page(translator('vi'), 'T', '', '')).toContain('<html lang="vi">');
    expect(page(translator('pt'), 'T', '', '')).toContain('<html lang="pt-BR">');
  });

  it('keeps English log text on keyed errors and translates them per reader', () => {
    const e = localized('api.run.connectFirst', { port: 'Photos' });
    expect(e.message).toBe('Connect "Photos" first');
    expect(e.in(translator('ko'))).toBe(translator('ko')('api.run.connectFirst', { port: 'Photos' }));
  });

  it('names gates for people and falls back to the id', () => {
    const t = translator('en');
    expect(gateName(t, 'silhouette_iou')).toBe('Silhouette match');
    expect(gateName(t, 'web:bytes')).toBe('File size');
    expect(gateName(t, 'mystery')).toBe('mystery');
  });

  it('writes export check messages with numbers formatted for the language', async () => {
    const bad = new Uint8Array([1, 2, 3, 4]);
    const en = await exportGlb(bad, 'web');
    const tri = (r: typeof en) => r.report.checks.find((c) => c.id === 'triangles')!.message;
    expect(tri(en)).toBe('0 of 150,000 triangles');
    expect(en.report.checks.find((c) => c.id === 'validator')!.message).toMatch(/^Not a valid glTF: /);
    expect(en.report.checks.find((c) => c.id === 'animation')!.message).toBe(
      '0 animation clips, none required',
    );
    const fr = await exportGlb(bad, 'web', translator('fr'));
    expect(tri(fr)).toContain(translator('fr').number(150_000));
    expect(translator('fr').number(150_000)).not.toBe('150,000');
  });
});
