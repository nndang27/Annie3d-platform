import { SIM_ENVIRONMENTS } from '@annie3d/contracts';
import { Camera, Pause, Play, RotateCcw, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { type LinkState, openLink, type SimMessage } from './link';
import './sim.css';

type Hello = Extract<SimMessage, { type: 'hello' }>;
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
const isSimEnvironment = (v: string): v is (typeof SIM_ENVIRONMENTS)[number] =>
  (SIM_ENVIRONMENTS as readonly string[]).includes(v);

/**
 * F13 phone remote (`/sim/<room>`): no sign-in. Tilt the phone to turn the product on the
 * screen, or drag on the pad; pick the place; ask for a snapshot, which the screen sends back
 * (two-way). Motion needs a user tap first (iOS permission prompt).
 */
export default function Controller() {
  const t = useT();
  const room = location.pathname.split('/')[2] ?? '';
  const [link, setLink] = useState<LinkState>('connecting');
  const [screens, setScreens] = useState(0);
  const [hello, setHello] = useState<Hello | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [motion, setMotion] = useState<'off' | 'on' | 'denied' | 'unsupported'>('off');
  const send = useRef<(m: SimMessage) => void>(() => {});
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const l = openLink(
      room,
      'controller',
      (m) => {
        if (m.type === 'presence') setScreens(m.screens);
        if (m.type === 'hello') setHello(m);
        if (m.type === 'snapshot') setSnapshot(m.dataUrl);
      },
      setLink,
    );
    send.current = l.send;
    return () => l.close();
  }, [room]);

  const startMotion = async () => {
    const DOE = window.DeviceOrientationEvent as OrientationCtor | undefined;
    if (!DOE) {
      setMotion('unsupported');
      return;
    }
    if (typeof DOE.requestPermission === 'function') {
      const r = await DOE.requestPermission().catch(() => 'denied');
      if (r !== 'granted') {
        setMotion('denied');
        return;
      }
    }
    let last = 0;
    window.addEventListener('deviceorientation', (e) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const now = performance.now();
      if (now - last < 33) return; // ~30 Hz is smooth after the screen's smoothing
      last = now;
      send.current({ type: 'pose', alpha: e.alpha, beta: e.beta, gamma: e.gamma });
    });
    setMotion('on');
    send.current({ type: 'recenter' });
  };

  const connected = link === 'open' && screens > 0;
  return (
    <div className="remote-page" data-testid="sim-controller">
      <header>
        <Smartphone size={18} />
        <b>{t('sim.remote.title')}</b>
        <span className="sim-status" data-state={connected ? 'open' : 'connecting'}>
          <i />
          {connected
            ? t('sim.remote.connected')
            : link === 'open'
              ? t('sim.remote.waitingScreen')
              : t('sim.status.connecting')}
        </span>
      </header>
      <h1>{hello?.title ?? t('sim.remote.product')}</h1>

      <button type="button" className="primary" onClick={startMotion} disabled={motion === 'on'}>
        {motion === 'on' ? t('sim.remote.tilt') : t('sim.remote.startMotion')}
      </button>
      {motion === 'denied' && <p className="hint">{t('sim.remote.motionDenied')}</p>}
      {motion === 'unsupported' && <p className="hint">{t('sim.remote.motionUnsupported')}</p>}

      <div
        className="pad"
        aria-label={t('sim.remote.padLabel')}
        data-testid="sim-pad"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          send.current({ type: 'drag', dx: (e.clientX - d.x) * 0.6, dy: (e.clientY - d.y) * 0.6 });
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {t('sim.remote.pad')}
      </div>

      <div className="row">
        <button type="button" onClick={() => send.current({ type: 'recenter' })}>
          <RotateCcw size={16} /> {t('sim.action.recenter')}
        </button>
        <button type="button" onClick={() => send.current({ type: 'spin', on: !hello?.spin })}>
          {hello?.spin ? <Pause size={16} /> : <Play size={16} />}{' '}
          {hello?.spin ? t('sim.remote.stop') : t('sim.remote.spin')}
        </button>
        <button type="button" onClick={() => send.current({ type: 'snap' })} data-testid="sim-snap">
          <Camera size={16} /> {t('sim.remote.snapshot')}
        </button>
      </div>

      {hello && (
        <div className="envs" role="group" aria-label={t('sim.remote.places')}>
          {hello.envs.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={hello.env === e.id}
              onClick={() => send.current({ type: 'env', env: e.id })}
            >
              {isSimEnvironment(e.id) ? t(`simEnv.${e.id}`) : e.label}
            </button>
          ))}
        </div>
      )}
      {snapshot && (
        <img className="snap" src={snapshot} alt={t('sim.remote.snapshotAlt')} data-testid="sim-snapshot" />
      )}
    </div>
  );
}
