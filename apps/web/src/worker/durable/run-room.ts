import { DurableObject } from 'cloudflare:workers';
import type { RunEvent } from '@annie3d/contracts';
import { createDb } from '@annie3d/db';
import { sql } from 'drizzle-orm';
import type { Env } from '../env';
import { executeRun, type RunEventBody } from '../services/runner';

const RETAIN_MS = 24 * 60 * 60 * 1000;

/**
 * One Durable Object per run (Cloudflare DO best practices: one object per coordination unit).
 * - Executes the run from `alarm()`, so an eviction is retried and resumes (alarms are
 *   at-least-once; the runner skips finished steps).
 * - Keeps a gap-free event log in its SQLite storage and fans events out over hibernatable
 *   WebSockets; a reconnecting client sends `?after=<seq>` and receives exactly what it missed.
 * - Deletes itself a day after the run finishes.
 */
export class RunRoom extends DurableObject<Env> {
  private abort: AbortController | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, body TEXT NOT NULL)',
      );
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    });
  }

  private meta(k: string): string | null {
    const r = this.ctx.storage.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0];
    return r?.v ?? null;
  }
  private setMeta(k: string, v: string) {
    this.ctx.storage.sql.exec(
      'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
      k,
      v,
    );
  }

  /** RPC from the Worker after the run row is committed. */
  async start(runId: string, queued: { plan: string[]; estimatedCredits: number }) {
    if (this.meta('runId')) return; // idempotent
    this.setMeta('runId', runId);
    this.emit({ type: 'run.queued', plan: queued.plan, estimatedCredits: queued.estimatedCredits });
    await this.ctx.storage.setAlarm(Date.now());
  }

  async cancel() {
    this.setMeta('cancelled', '1');
    this.abort?.abort();
    // Not executing right now (e.g. waiting on a retry): run the alarm soon so it finalises.
    if (!this.abort && !this.meta('finished')) await this.ctx.storage.setAlarm(Date.now());
  }

  async alarm() {
    if (this.meta('finished')) {
      await this.ctx.storage.deleteAll();
      return;
    }
    const runId = this.meta('runId');
    if (!runId) return;
    const controller = new AbortController();
    this.abort = controller;
    if (this.meta('cancelled')) controller.abort();
    const { db, client } = createDb(this.env.HYPERDRIVE.connectionString);
    await client.connect();
    try {
      await executeRun(this.env, db, runId, { emit: async (e) => this.emit(e) }, controller.signal);
      await db.execute(sql`UPDATE runs SET last_event_seq = ${this.lastSeq()} WHERE id = ${runId}`);
    } finally {
      this.abort = null;
      await client.end().catch(() => {});
    }
    if (this.finished()) {
      this.setMeta('finished', '1');
      await this.ctx.storage.setAlarm(Date.now() + RETAIN_MS);
    }
  }

  private lastSeq(): number {
    return (
      this.ctx.storage.sql.exec<{ s: number | null }>('SELECT max(seq) AS s FROM events').toArray()[0]?.s ?? 0
    );
  }
  private finished(): boolean {
    return (
      this.ctx.storage.sql
        .exec('SELECT 1 FROM events WHERE body LIKE \'{"type":"run.finished"%\' LIMIT 1')
        .toArray().length > 0
    );
  }

  private emit(e: RunEventBody) {
    const seq = this.lastSeq() + 1;
    const runId = this.meta('runId')!;
    // `type` first so finished() can match the stored text without parsing it.
    const { type, ...rest } = e;
    const event = { type, ...rest, runId, seq, at: new Date().toISOString() } as RunEvent;
    const body = JSON.stringify(event);
    this.ctx.storage.sql.exec('INSERT INTO events (seq, body) VALUES (?, ?)', seq, body);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(body);
      } catch {
        /* closed socket; the runtime cleans it up */
      }
    }
  }

  /** WebSocket upgrade (authorised by the Worker route before it forwards the request). */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    const after = Number(new URL(request.url).searchParams.get('after') ?? '0') || 0;
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // Hibernation API: the object can be evicted while sockets stay open (no duration billing).
    this.ctx.acceptWebSocket(server);
    for (const row of this.ctx.storage.sql.exec<{ body: string }>(
      'SELECT body FROM events WHERE seq > ? ORDER BY seq',
      after,
    )) {
      server.send(row.body);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') ws.send('pong');
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, 'closing');
    } catch {}
  }
}
