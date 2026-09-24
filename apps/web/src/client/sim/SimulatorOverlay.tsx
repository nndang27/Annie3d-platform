import { SIM_ENVIRONMENTS, type SimEnvironment } from '@annie3d/contracts';
import { type DevicePose, SimViewer } from '@annie3d/viewer-3d';
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
import { perfEnd } from '../lib/perf';
import { dispatch, useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import { SIM_ENV_META, simInputs, useSimKey } from './inputs';
import { controllerUrl, type LinkState, newRoomId, openLink, type SimMessage } from './link';
import './sim.css';

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
  const node = useBoard((s) => s.graph.nodes.get(nodeId));
  useSimKey(nodeId);
  const inputs = simInputs(nodeId);
  const env = (node?.settings.environment as SimEnvironment | undefined) ?? 'shop';
  const price = String(node?.settings.price ?? '$49');
  const cta = String(node?.settings.cta ?? 'Shop now');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slotEl = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<SimViewer | null>(null);
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
    const v = new SimViewer(c);
    viewer.current = v;
    v.setSpin(true);
    return () => {
      v.dispose();
      c.remove();
      canvasRef.current = null;
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    const v = viewer.current;
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
      .catch((e: Error) => toast(`Could not load the 3D model: ${e.message}`, 'error'));
  }, [inputs.glb]);

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
          <p className="sim-empty">Wire a 3D model into this node to see it here.</p>
        ))}
      {inputs.glb && !ready && <p className="sim-empty">Loading 3D…</p>}
    </div>
  );

  return (
    <div
      className="sim-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Simulator"
      data-testid="simulator"
    >
      <header className="sim-head">
        <b className="sim-title">Simulation</b>
        <nav className="sim-tabs" aria-label="Environment">
          {SIM_ENVIRONMENTS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={env === id}
              onClick={() => setEnv(id)}
              title={SIM_ENV_META[id].hint}
              data-testid={`sim-env-${id}`}
            >
              {SIM_ENV_META[id].label}
            </button>
          ))}
        </nav>
        <span className="grow" />
        <button
          type="button"
          className="sim-icon"
          onClick={toggleSpin}
          aria-label={spin ? 'Stop spin' : 'Spin'}
        >
          {spin ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className="sim-icon"
          onClick={download}
          aria-label="Download PNG"
          title="Download PNG"
        >
          <Download size={16} />
        </button>
        <button type="button" className="sim-icon" onClick={close} aria-label="Close simulator">
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
              <span>shop.example.com/products/{inputs.title.toLowerCase().replace(/[^\w]+/g, '-')}</span>
            </div>
            <div className="shop-nav">
              {inputs.logo ? (
                <img src={inputs.logo} alt="" className="logo" />
              ) : (
                <b className="brand">BRAND</b>
              )}
              <span>New</span>
              <span>Shop</span>
              <span>About</span>
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
                <p className="crumb">Home / New arrivals</p>
                <h1>{inputs.title}</h1>
                <p className="rating">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                  <span>4.9 · 128 reviews</span>
                </p>
                <p className="price">{price}</p>
                <p className="desc">Drag to turn it around. What you see is the real 3D product.</p>
                <div className="swatches">
                  <i />
                  <i />
                  <i />
                </div>
                <button type="button" className="add">
                  Add to cart
                </button>
                <button type="button" className="buy-now">
                  {cta}
                </button>
                <ul>
                  <li>Free shipping over $50</li>
                  <li>30-day returns</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {env === 'tiktok' && (
          <div className="tiktok">
            <div className="phone">
              <div className="feed-top">
                <span>Following</span>
                <b>For You</b>
              </div>
              {stage}
              <div className="rail">
                <span>
                  <Heart size={26} fill="#fff" />
                  12.4K
                </span>
                <span>
                  <MessageCircle size={26} fill="#fff" />
                  318
                </span>
                <span>
                  <Bookmark size={26} fill="#fff" />
                  2.1K
                </span>
                <span>
                  <Send size={24} />
                  Share
                </span>
              </div>
              <div className="caption">
                <b>@yourbrand</b>
                <p>
                  {inputs.title} ✨ <span>#fyp #tiktokshop #newin</span>
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
              <p className="msg in">did you see the new drop?? 👀</p>
              <p className="msg out">sending you the sticker</p>
              <div className="sticker-slot">{stage}</div>
              <p className="msg in">omg want 😍</p>
            </div>
            <p className="sticker-note">
              The sticker is the live view with a transparent background: turn it, then download the PNG.
            </p>
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
                <Smartphone size={16} /> Phone remote
              </h2>
              <p className="muted">
                Scan with your phone, then tilt it: the product follows. Two-way: the phone sees what this
                screen shows.
              </p>
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
                  Phones cannot open localhost. Open this board through the <code>pnpm share</code> link to
                  pair a phone.
                </p>
              )}
              <p className="sim-status" data-state={link}>
                <i />
                {link !== 'open'
                  ? 'Connecting…'
                  : phones
                    ? `${phones} phone${phones > 1 ? 's' : ''} connected`
                    : 'Waiting for a phone'}
              </p>
              {pose && (
                <p className="pose" data-testid="sim-pose">
                  α {pose.alpha.toFixed(0)}° · β {pose.beta.toFixed(0)}° · γ {pose.gamma.toFixed(0)}°
                </p>
              )}
              <button type="button" className="sim-btn" onClick={() => viewer.current?.recenter()}>
                <RotateCcw size={14} /> Recenter
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
