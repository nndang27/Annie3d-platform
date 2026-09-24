import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../env';

/** Sockets per room: one screen and a few phones is the expected shape. */
const MAX_SOCKETS = 8;
/** Messages are small JSON commands; screen snapshots sent back to the phone stay under this. */
const MAX_MESSAGE = 200_000;

/**
 * F13 live two-way link between a simulation screen and phones ("remote"): a relay room.
 * Every JSON message from one socket goes to all other sockets of the room, and presence counts
 * are broadcast on join/leave. Rooms are addressed by an unguessable id minted by the screen;
 * nothing is stored. Hibernation API: idle rooms cost nothing while sockets stay open.
 */
export class SimRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response('Room full', { status: 429 });
    const q = new URL(request.url).searchParams;
    const role = q.get('role') === 'controller' ? 'controller' : 'screen';
    // One id per page: a reconnect (network blip, React StrictMode remount) replaces the old
    // socket instead of counting as a second phone.
    const cid = /^[A-Za-z0-9_-]{8,64}$/.test(q.get('cid') ?? '') ? q.get('cid')! : crypto.randomUUID();
    for (const old of this.ctx.getWebSockets(`cid:${cid}`)) {
      try {
        old.close(4000, 'replaced');
      } catch {}
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [role, `cid:${cid}`]);
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    if (message === 'ping') {
      ws.send('pong');
      return;
    }
    if (!message.startsWith('{"type":')) return;
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      try {
        other.send(message);
      } catch {
        /* closed socket; the runtime cleans it up */
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, 'closing');
    } catch {}
    this.presence(ws);
  }

  private presence(leaving?: WebSocket) {
    // Distinct pages per role (sockets closing or replaced are not counted).
    const live = (tag: string) =>
      new Set(
        this.ctx
          .getWebSockets(tag)
          .filter((w) => w !== leaving && w.readyState === WebSocket.OPEN)
          .map((w) => this.ctx.getTags(w).find((t) => t.startsWith('cid:'))),
      ).size;
    const body = JSON.stringify({
      type: 'presence',
      screens: live('screen'),
      controllers: live('controller'),
    });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === leaving) continue;
      try {
        ws.send(body);
      } catch {}
    }
  }
}
