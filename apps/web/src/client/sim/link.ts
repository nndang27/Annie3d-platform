/**
 * F13 remote link: messages between the simulation screen and phones, relayed by the SimRoom
 * Durable Object. Screen → phone: `hello` (title, environments, current one), `snapshot`.
 * Phone → screen: `pose`, `drag`, `recenter`, `spin`, `env`, `snap`.
 */
export type SimMessage =
  | { type: 'presence'; screens: number; controllers: number }
  | { type: 'hello'; title: string; env: string; envs: { id: string; label: string }[]; spin: boolean }
  | { type: 'pose'; alpha: number; beta: number; gamma: number }
  | { type: 'drag'; dx: number; dy: number }
  | { type: 'recenter' }
  | { type: 'spin'; on: boolean }
  | { type: 'env'; env: string }
  | { type: 'snap' }
  | { type: 'snapshot'; dataUrl: string };

export type LinkState = 'connecting' | 'open' | 'closed';

/** This page's id in a room: reconnects replace the old socket instead of adding a peer. */
const CLIENT_ID = newRoomId();

/** 128 random bits, base64url: the room id is the capability to join it. */
export function newRoomId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function controllerUrl(room: string): string {
  return `${location.origin}/sim/${room}`;
}

/** Reconnecting WebSocket to a room. Returns send() and close(). */
export function openLink(
  room: string,
  role: 'screen' | 'controller',
  onMessage: (m: SimMessage) => void,
  onState: (s: LinkState) => void,
) {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let ping: ReturnType<typeof setInterval> | null = null;
  let again: ReturnType<typeof setTimeout> | null = null;
  const connect = () => {
    onState('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/api/sim/${room}/ws?role=${role}&cid=${CLIENT_ID}`);
    ws.onopen = () => {
      retry = 0;
      onState('open');
      // Keeps mobile networks and proxies from dropping an idle socket.
      ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25_000);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        onMessage(JSON.parse(e.data) as SimMessage);
      } catch {
        /* not ours */
      }
    };
    ws.onclose = () => {
      if (ping) clearInterval(ping);
      onState('closed');
      if (!closed) again = setTimeout(connect, Math.min(8000, 500 * 2 ** retry++));
    };
  };
  connect();
  return {
    send(m: SimMessage) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    },
    close() {
      closed = true;
      if (again) clearTimeout(again);
      if (ping) clearInterval(ping);
      const w = ws;
      if (!w) return;
      // A closed link reports nothing more (a late close must not overwrite the next link's state).
      w.onmessage = null;
      w.onclose = null;
      // Aborting a socket that is still connecting logs a browser error: let it open, then close.
      if (w.readyState === WebSocket.CONNECTING) w.onopen = () => w.close();
      else w.close();
    },
  };
}
