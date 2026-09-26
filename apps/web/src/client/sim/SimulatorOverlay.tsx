import { SIM_ENVIRONMENTS, type SimEnvironment } from '@annie3d/contracts';
import { type DevicePose, prefetchRoomEnvironment, SimViewer } from '@annie3d/viewer-3d';
import {
  Bookmark,
  Download,
  Heart,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShoppingBag,
  Smartphone,
  Star,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderSVG } from 'uqr';
import { rich, t as tNow, useT } from '../i18n';
import { afterNextPaint } from '../lib/afterNextPaint';
import { perfEnd } from '../lib/perf';
import { dispatch, useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { SIM_ENV_META, simInputs, useSimKey } from './inputs';
import { controllerUrl, type LinkState, newRoomId, openLink, type SimMessage } from './link';
import './sim.css';

// This chunk loads on hover or at idle (lib/preload.ts): fetch the baked room lighting now too.
prefetchRoomEnvironment().catch(() => {});

/** Social counters on the TikTok mock-up, short form (12.4K). */
const COMPACT: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 1 };

/** A small JPEG of the view for the phone (two-way link): white background, 360 px wide. */
async function phoneSnapshot(viewer: SimViewer): Promise<string> {
  const img = new Image();
  img.src = viewer.snapshot('image/png');
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = Math.round((img.height / img.width) * c.width);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/**
 * F13 simulator: the product, live in 3D, inside a simulated place: a shop page, a TikTok feed,
 * a chat sticker, or a showroom steered from a phone (two-way: the phone sends pose and
 * commands, the screen answers with state and snapshots). One WebGL canvas moves between layouts.
 */
export default function SimulatorOverlay({ nodeId }: { nodeId: string }) {
  const t = useT();
  const node = useBoard((s) => s.graph.nodes.get(nodeId));
  useSimKey(nodeId);
  const inputs = simInputs(nodeId);
  const env = (node?.settings.environment as SimEnvironment | undefined) ?? 'shop';
  const price = String(node?.settings.price ?? '$49');
  const cta = String(node?.settings.cta ?? t('setting.simulation.cta'));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slotEl = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<SimViewer | null>(null);
  /** The WebGL viewer, once built (after the overlay's first paint); the model load waits for it. */
  const [glViewer, setGlViewer] = useState<SimViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [spin, setSpin] = useState(true);
  const [room] = useState(newRoomId);
  const [link, setLink] = useState<LinkState>('connecting');
  const [phones, setPhones] = useState(0);
  const [pose, setPose] = useState<DevicePose | null>(null);
  const send = useRef<(m: SimMessage) => void>(() => {});

  const close = useCallback(() => useUi.setState({ simulatingNodeId: null }), []);
  const setEnv = useCallback(
    (e: SimEnvironment) =>
      dispatch([{ type: 'node.update', id: nodeId, patch: { settings: { environment: e } } }]),
    [nodeId],
  );

  // Viewer: one WebGL context per mount, on a canvas made per mount (a disposed context cannot be
  // reused, and StrictMode mounts twice).
  useEffect(() => {
    const c = document.createElement('canvas');
    c.className = 'sim-canvas';
    c.setAttribute('data-testid', 'sim-canvas');
    canvasRef.current = c;
    slotEl.current?.appendChild(c);
    // Paint the simulator first, then build the WebGL context (see EditorOverlay).
    let v: SimViewer | null = null;
    const cancel = afterNextPaint(() => {
      v = new SimViewer(c);
      viewer.current = v;
      v.setSpin(true);
      setGlViewer(v);
    });
    return () => {
      cancel();
      v?.dispose();
      c.remove();
      canvasRef.current = null;
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    const v = glViewer;
    if (!v) return;
    if (!inputs.glb) {
      perfEnd('simulator.open');
      return;
    }
    setReady(false);
    v.load(inputs.glb)
      .then(() => {
        perfEnd('simulator.open');
        setReady(true);
      })
      .catch((e: Error) => toast(tNow('sim.toast.loadFailed', { message: e.message }), 'error'));
  }, [inputs.glb, glViewer]);

  // Two-way remote link.
  const state = useRef({ title: inputs.title, env, spin });
  state.current = { title: inputs.title, env, spin };
  const hello = useCallback(() => {
    send.current({
      type: 'hello',
      title: state.current.title,
      env: state.current.env,
      envs: SIM_ENVIRONMENTS.map((id) => ({ id, label: SIM_ENV_META[id].label })),
      spin: state.current.spin,
    });
  }, []);
  useEffect(() => {
    const l = openLink(
      room,
      'screen',
      (m) => {
        const v = viewer.current;
        switch (m.type) {
          case 'presence':
            setPhones(m.controllers);
            if (m.controllers) hello();
            break;
          case 'pose':
            v?.setDevicePose(m);
            setSpin(false);
            setPose(m);
            break;
          case 'drag':
            v?.setSpin(false);
            setSpin(false);
            v?.nudge(m.dx, m.dy);
            break;
          case 'recenter':
            v?.recenter();
            break;
          case 'spin':
            v?.setSpin(m.on);
            setSpin(m.on);
            break;
          case 'env':
            if ((SIM_ENVIRONMENTS as readonly string[]).includes(m.env)) setEnv(m.env as SimEnvironment);
            break;
          case 'snap':
            if (v) void phoneSnapshot(v).then((dataUrl) => send.current({ type: 'snapshot', dataUrl }));
            break;
        }
      },
      setLink,
    );
    send.current = l.send;
    return () => l.close();
  }, [room, hello, setEnv]);
  // Tell the phone whenever what it shows changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-announce on these changes.
  useEffect(() => {
    if (phones) hello();
  }, [env, inputs.title, spin, phones, hello]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // The single canvas is moved into whichever layout is showing (moving keeps the WebGL context).
  const slot = useCallback((el: HTMLDivElement | null) => {
    slotEl.current = el;
    const c = canvasRef.current;
    if (el && c && c.parentElement !== el) el.appendChild(c);
  }, []);

  const toggleSpin = () => {
    viewer.current?.setSpin(!spin);
    setSpin(!spin);
  };
  const download = () => {
    const v = viewer.current;
    if (!v) return;
    const a = document.createElement('a');
    a.href = v.snapshot('image/png');
    a.download = `${inputs.title.replace(/[^\w-]+/g, '-').toLowerCase()}-${env}.png`;
    a.click();
  };
  const url = controllerUrl(room);
  const qr = useMemo(() => renderSVG(url, { border: 1, pixelSize: 6 }), [url]);
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);

  const stage = (
    <div className="sim-slot" ref={slot}>
      {!inputs.glb &&
        (inputs.poster ? (
          <img className="sim-still" src={inputs.poster} alt={inputs.title} />
        ) : (
          <p className="sim-empty">{t('sim.stage.empty')}</p>
        ))}
      {inputs.glb && !ready && <p className="sim-empty">{t('sim.stage.loading')}</p>}
    </div>
  );

  return (
    <div
      className="sim-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('sim.dialog.label')}
      data-testid="simulator"
    >
      <header className="sim-head">
        <b className="sim-title">{t('node.simulation')}</b>
        <nav className="sim-tabs" aria-label={t('sim.head.environments')}>
          {SIM_ENVIRONMENTS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={env === id}
              onClick={() => setEnv(id)}
              title={t(`sim.envHint.${id}`)}
              data-testid={`sim-env-${id}`}
            >
              {t(`simEnv.${id}`)}
            </button>
          ))}
        </nav>
        <span className="grow" />
        <button
          type="button"
          className="sim-icon"
          onClick={toggleSpin}
          aria-label={spin ? t('sim.head.stopSpin') : t('sim.head.spin')}
        >
          {spin ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="sim-icon"
          onClick={download}
          aria-label={t('sim.head.download')}
          title={t('sim.head.download')}
        >
          <Download size={16} />
        </button>
        <button type="button" className="sim-icon" onClick={close} aria-label={t('sim.head.close')}>
          <X size={18} />
        </button>
      </header>

      <main className={`sim-body sim-${env}`}>
        {env === 'shop' && (
          <div className="shop">
            <div className="chrome">
              <i />
              <i />
              <i />
              {/* A sample address, not text to translate. i18n-ignore */}
              <span>shop.example.com/products/{inputs.title.toLowerCase().replace(/[^\w]+/g, '-')}</span>
            </div>
            <div className="shop-nav">
              {inputs.logo ? (
                <img src={inputs.logo} alt="" className="logo" />
              ) : (
                <b className="brand">{t('sim.shop.brand')}</b>
              )}
              <span>{t('sim.shop.navNew')}</span>
              <span>{t('sim.shop.navShop')}</span>
              <span>{t('sim.shop.navAbout')}</span>
              <span className="grow" />
              <ShoppingBag size={18} />
            </div>
            <div className="shop-main">
              <div className="gallery">
                {stage}
                <div className="thumbs">
                  {[0, 1, 2].map((i) => (
                    <span key={i}>{inputs.poster && <img src={inputs.poster} alt="" />}</span>
                  ))}
                </div>
              </div>
              <div className="buy">
                <p className="crumb">{t('sim.shop.crumb')}</p>
                <h1>{inputs.title}</h1>
                <p className="rating">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                  <span>{t('sim.shop.rating', { rating: 4.9, count: 128 })}</span>
                </p>
                <p className="price">{price}</p>
                <p className="desc">{t('sim.shop.description')}</p>
                <div className="swatches">
                  <i />
                  <i />
                  <i />
                </div>
                <button type="button" className="add">
                  {t('sim.shop.addToCart')}
                </button>
                <button type="button" className="buy-now">
                  {cta}
                </button>
                <ul>
                  <li>{t('sim.shop.freeShipping')}</li>
                  <li>{t('sim.shop.returns')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {env === 'tiktok' && (
          <div className="tiktok">
            <div className="phone">
              <div className="feed-top">
                <span>{t('sim.tiktok.following')}</span>
                <b>{t('sim.tiktok.forYou')}</b>
              </div>
              {stage}
              <div className="rail">
                <span>
                  <Heart size={26} fill="#fff" />
                  {t.number(12_400, COMPACT)}
                </span>
                <span>
                  <MessageCircle size={26} fill="#fff" />
                  {t.number(318, COMPACT)}
                </span>
                <span>
                  <Bookmark size={26} fill="#fff" />
                  {t.number(2_100, COMPACT)}
                </span>
                <span>
                  <Send size={24} />
                  {t('sim.tiktok.share')}
                </span>
              </div>
              <div className="caption">
                <b>{t('sim.tiktok.handle')}</b>
                <p>
                  {inputs.title} ✨ <span>{t('sim.tiktok.tags')}</span>
                </p>
                <div className="shop-card">
                  <ShoppingBag size={16} />
                  <span>{inputs.title}</span>
                  <b>{price}</b>
                  <em>{cta}</em>
                </div>
              </div>
            </div>
          </div>
        )}

        {env === 'sticker' && (
          <div className="sticker-env">
            <div className="chat">
              <p className="msg in">{t('sim.sticker.msgAsk')}</p>
              <p className="msg out">{t('sim.sticker.msgSend')}</p>
              <div className="sticker-slot">{stage}</div>
              <p className="msg in">{t('sim.sticker.msgReply')}</p>
            </div>
            <p className="sticker-note">{t('sim.sticker.note')}</p>
          </div>
        )}

        {env === 'showroom' && (
          <div className="showroom">
            <div className="stagebox">
              {stage}
              <span className="plinth" />
              <p className="name">{inputs.title}</p>
            </div>
            <aside className="remote" data-testid="sim-remote">
              <h2>
                <Smartphone size={16} /> {t('sim.showroom.title')}
              </h2>
              <p className="muted">{t('sim.showroom.help')}</p>
              {/* QR of our own controller URL (uqr output, no user content). */}
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <a
                className="link"
                href={url}
                target="_blank"
                rel="noreferrer"
                data-testid="sim-controller-link"
              >
                {url.replace(/^https?:\/\//, '')}
              </a>
              {local && (
                <p className="warn">
                  {rich(t, 'sim.showroom.localhost', {
                    command: <code>pnpm share</code>, // i18n-ignore: a command name
                  })}
                </p>
              )}
              <p className="sim-status" data-state={link}>
                <i />
                {link !== 'open'
                  ? t('sim.status.connecting')
                  : phones
                    ? t('sim.showroom.phones', { count: phones })
                    : t('sim.showroom.waiting')}
              </p>
              {pose && (
                <p className="pose" data-testid="sim-pose">
                  {t('sim.showroom.pose', {
                    alpha: Math.round(pose.alpha),
                    beta: Math.round(pose.beta),
                    gamma: Math.round(pose.gamma),
                  })}
                </p>
              )}
              <button type="button" className="sim-btn" onClick={() => viewer.current?.recenter()}>
                <RotateCcw size={14} /> {t('sim.action.recenter')}
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
