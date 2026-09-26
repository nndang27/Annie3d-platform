import {
  type Graph,
  NODE_DEFS,
  NODE_KINDS,
  type NodeKind,
  type NodeVersionDto,
  PORT_COLOR,
  type RunEvent,
} from '@annie3d/contracts';
import { nodeName, t } from '../i18n';

/**
 * F12 process reel, recorded in the browser: 540×960 (9:16), the finished ad on top and a
 * replay of the run on the board below, timed from the run's own event log. Canvas frames +
 * the ad's audio go through MediaRecorder; no server rendering needed.
 */
const W = 540;
const H = 960;
const TOP = 540;
const REPLAY = { x: 20, y: 590, w: 500, h: 300 };

interface Step {
  start: number;
  end: number | null;
  failed: boolean;
  progress: { t: number; p: number; stage: string }[];
}

/** Replays the run's events (the run room keeps them) over its WebSocket. */
export function runEvents(runId: string): Promise<RunEvent[]> {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/runs/${runId}/events?after=0`);
    const out: RunEvent[] = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(t('reel.historyUnavailable')));
    }, 15_000);
    ws.onmessage = (m) => {
      const e = JSON.parse(String(m.data)) as RunEvent;
      out.push(e);
      if (e.type === 'run.finished') {
        clearTimeout(timer);
        ws.close();
        resolve(out);
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error(t('reel.couldNotLoadHistory')));
    };
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function pickMime(): { mime: string; container: 'video/mp4' | 'video/webm' } {
  const options = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mime =
    options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ??
    'video/webm';
  return { mime, container: mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
) {
  if (!sw || !sh) return;
  const s = Math.min(w / sw, h / sh) * zoom;
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export interface ReelInput {
  runId: string;
  graph: Graph;
  versions: Map<string, NodeVersionDto>;
  title: string;
  /** Receives the live canvas so the dialog can show the recording as it happens. */
  canvas: HTMLCanvasElement;
  onProgress?: (p: number) => void;
}

export async function recordReel(
  input: ReelInput,
): Promise<{ blob: Blob; mime: 'video/mp4' | 'video/webm'; durationMs: number }> {
  const events = await runEvents(input.runId);
  const at = (e: RunEvent) => Date.parse(e.at);
  const t0 = at(events.find((e) => e.type === 'run.started') ?? events[0]!);
  const t1 = at(events.at(-1)!);
  const plan =
    (events.find((e) => e.type === 'run.queued') as Extract<RunEvent, { type: 'run.queued' }> | undefined)
      ?.plan ?? [];
  const steps = new Map<string, Step>();
  for (const e of events) {
    if (!('nodeId' in e)) continue;
    const s = steps.get(e.nodeId) ?? {
      start: Number.POSITIVE_INFINITY,
      end: null,
      failed: false,
      progress: [],
    };
    if (e.type === 'step.started') s.start = at(e);
    if (e.type === 'step.progress') {
      s.start = Math.min(s.start, at(e));
      s.progress.push({ t: at(e), p: e.progress, stage: e.stage });
    }
    if (e.type === 'step.succeeded') s.end = at(e);
    if (e.type === 'step.failed' || e.type === 'step.skipped') {
      s.end = at(e);
      s.failed = true;
    }
    steps.set(e.nodeId, s);
  }

  // Nodes: the run's plan plus the inputs that fed it.
  const g = input.graph;
  const ids = new Set(plan);
  for (const e of g.edges.values()) if (ids.has(e.target)) ids.add(e.source);
  const nodes = [...ids].map((id) => g.nodes.get(id)).filter((n): n is NonNullable<typeof n> => !!n);
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + 300));
  const maxY = Math.max(...nodes.map((n) => n.y + 260));
  const scale = Math.min(REPLAY.w / Math.max(1, maxX - minX), REPLAY.h / Math.max(1, maxY - minY));
  const box = (n: (typeof nodes)[number]) => ({
    x: REPLAY.x + (n.x - minX) * scale + (REPLAY.w - (maxX - minX) * scale) / 2,
    y: REPLAY.y + (n.y - minY) * scale,
    w: 300 * scale,
    h: 230 * scale,
  });
  const primary = (id: string) => {
    const n = g.nodes.get(id);
    return n?.currentVersionId ? input.versions.get(n.currentVersionId)?.outputs[0] : undefined;
  };
  const thumbs = new Map<string, HTMLImageElement>();
  await Promise.all(
    nodes.map(async (n) => {
      const a = primary(n.id);
      const src = a?.urls.thumb ?? a?.urls.poster;
      const img = src ? await loadImage(src) : null;
      if (img) thumbs.set(n.id, img);
    }),
  );

  // Top: the finished ad (with its music), or the best still if the run had no video.
  const adNode =
    nodes.find((n) => n.kind === 'adVideo' && primary(n.id)?.kind === 'video') ??
    [...g.nodes.values()].find((n) => n.kind === 'adVideo' && primary(n.id)?.kind === 'video');
  const adUrl = adNode ? primary(adNode.id)?.urls.original : null;
  const hero = [...nodes]
    .reverse()
    .map((n) => primary(n.id))
    .find((a) => a?.urls.poster);
  const heroImg = hero?.urls.poster ? await loadImage(hero.urls.poster) : null;
  let video: HTMLVideoElement | null = null;
  if (adUrl) {
    video = document.createElement('video');
    video.src = adUrl;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      video!.onloadeddata = () => resolve();
      video!.onerror = () => resolve();
      setTimeout(resolve, 5000);
    });
  }
  const durationMs = Math.min(
    15_000,
    Math.max(8_000, video?.duration && Number.isFinite(video.duration) ? video.duration * 1000 : 10_000),
  );

  const canvas = input.canvas;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const stream = canvas.captureStream(30);
  let audio: AudioContext | null = null;
  if (video) {
    try {
      audio = new AudioContext();
      const src = audio.createMediaElementSource(video);
      const dest = audio.createMediaStreamDestination();
      src.connect(dest); // recorded, not played through the speakers
      for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    } catch {
      audio = null;
    }
  }
  const { mime, container } = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });

  // Texts drawn into the video, in the language at the start of the recording.
  const words = {
    howItWasMade: t('reel.howItWasMade'),
    madeWith: t('reel.madeWith'),
    tagline: t('reel.tagline'),
    kind: Object.fromEntries(NODE_KINDS.map((k) => [k, t(`node.${k}`)])) as Record<NodeKind, string>,
  };
  const draw = (elapsed: number) => {
    const k = Math.min(1, elapsed / durationMs);
    const runT = t0 + (t1 - t0) * Math.min(1, k * 1.15); // replay finishes just before the end
    ctx.fillStyle = '#0f1012';
    ctx.fillRect(0, 0, W, H);
    // Top: ad
    if (video && video.readyState >= 2)
      drawContain(ctx, video, video.videoWidth, video.videoHeight, 0, 0, W, TOP);
    else if (heroImg)
      drawContain(ctx, heroImg, heroImg.naturalWidth, heroImg.naturalHeight, 0, 0, W, TOP, 1 + 0.08 * k);
    ctx.fillStyle = '#9a9ea5';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(words.howItWasMade, REPLAY.x, TOP + 30);
    ctx.fillStyle = '#f2f2f0';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(input.title.slice(0, 40), REPLAY.x, TOP + 54 - 2);
    // Edges
    for (const e of g.edges.values()) {
      const a = g.nodes.get(e.source);
      const b = g.nodes.get(e.target);
      if (!a || !b || !ids.has(a.id) || !ids.has(b.id)) continue;
      const ba = box(a);
      const bb = box(b);
      const out = NODE_DEFS[a.kind].output?.type;
      ctx.strokeStyle = out ? PORT_COLOR[out] : '#555';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const x1 = ba.x + ba.w;
      const y1 = ba.y + ba.h * 0.3;
      const x2 = bb.x;
      const y2 = bb.y + bb.h * 0.3;
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + 30, y1, x2 - 30, y2, x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Nodes
    for (const n of nodes) {
      const b = box(n);
      const s = steps.get(n.id);
      const inRun = plan.includes(n.id);
      const running = !!s && runT >= s.start && (s.end === null || runT < s.end);
      const done = !inRun || (!!s?.end && runT >= s.end && !s.failed);
      ctx.fillStyle = '#1b1c1f';
      roundRect(ctx, b.x, b.y, b.w, b.h, 8);
      ctx.fill();
      ctx.strokeStyle = running ? '#5b8cff' : '#2a2c30';
      ctx.lineWidth = running ? 2 : 1;
      ctx.stroke();
      const img = thumbs.get(n.id);
      if (img && done) {
        const fade = !inRun || !s?.end ? 1 : Math.min(1, (runT - s.end) / 400);
        ctx.save();
        ctx.globalAlpha = fade;
        roundRect(ctx, b.x + 3, b.y + 14, b.w - 6, b.h - 18, 6);
        ctx.clip();
        drawContain(ctx, img, img.naturalWidth, img.naturalHeight, b.x + 3, b.y + 14, b.w - 6, b.h - 18);
        ctx.restore();
      }
      ctx.fillStyle = '#c8cbd0';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText(nodeName(t, n).slice(0, 18), b.x + 5, b.y + 10);
      if (running && s) {
        const last = [...s.progress].reverse().find((p) => p.t <= runT);
        const p = last?.p ?? 0.05;
        ctx.fillStyle = '#2a2c30';
        ctx.fillRect(b.x + 4, b.y + b.h - 6, b.w - 8, 3);
        ctx.fillStyle = '#5b8cff';
        ctx.fillRect(b.x + 4, b.y + b.h - 6, (b.w - 8) * p, 3);
        if (last?.stage) {
          ctx.fillStyle = '#9a9ea5';
          ctx.font = '9px system-ui, sans-serif';
          ctx.fillText(last.stage.slice(0, 22), b.x + 5, b.y + b.h - 10);
        }
      }
    }
    // Footer
    ctx.fillStyle = '#f2f2f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(words.madeWith, REPLAY.x, H - 28);
    // The tagline follows the brand line (170 px in, further when a language's line is longer).
    const taglineX = REPLAY.x + Math.max(170, ctx.measureText(words.madeWith).width + 20);
    ctx.fillStyle = '#9a9ea5';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(words.tagline, taglineX, H - 28);
  };

  draw(0);
  rec.start(250);
  if (video) {
    video.currentTime = 0;
    await video.play().catch(() => {});
  }
  if (audio?.state === 'suspended') await audio.resume().catch(() => {});
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      draw(elapsed);
      input.onProgress?.(Math.min(1, elapsed / durationMs));
      if (elapsed >= durationMs) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  video?.pause();
  video?.removeAttribute('src');
  video?.load();
  await audio?.close().catch(() => {});
  for (const t of stream.getTracks()) t.stop();
  return { blob: new Blob(chunks, { type: container }), mime: container, durationMs };
}
