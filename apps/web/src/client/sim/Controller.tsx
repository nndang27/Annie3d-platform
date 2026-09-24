import { Camera, Pause, Play, RotateCcw, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type LinkState, openLink, type SimMessage } from './link';
import './sim.css';

type Hello = Extract<SimMessage, { type: 'hello' }>;
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

/**
 * F13 phone remote (`/sim/<room>`): no sign-in. Tilt the phone to turn the product on the
 * screen, or drag on the pad; pick the place; ask for a snapshot, which the screen sends back
 * (two-way). Motion needs a user tap first (iOS permission prompt).
 */
export default function Controller() {
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
        <b>Annie 3D Remote</b>
        <span className="sim-status" data-state={connected ? 'open' : 'connecting'}>
          <i />
          {connected ? 'Connected' : link === 'open' ? 'Waiting for the screen' : 'Connecting…'}
        </span>
      </header>
      <h1>{hello?.title ?? 'Product'}</h1>

      <button type="button" className="primary" onClick={startMotion} disabled={motion === 'on'}>
        {motion === 'on' ? 'Tilt your phone to turn it' : 'Start motion control'}
      </button>
      {motion === 'denied' && <p className="hint">Motion access was refused. Use the pad below.</p>}
      {motion === 'unsupported' && <p className="hint">This device has no motion sensor. Use the pad.</p>}

      <div
        className="pad"
        aria-label="Drag to turn the product"
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
        Drag here to turn
      </div>

      <div className="row">
        <button type="button" onClick={() => send.current({ type: 'recenter' })}>
          <RotateCcw size={16} /> Recenter
        </button>
        <button type="button" onClick={() => send.current({ type: 'spin', on: !hello?.spin })}>
          {hello?.spin ? <Pause size={16} /> : <Play size={16} />} {hello?.spin ? 'Stop' : 'Spin'}
        </button>
        <button type="button" onClick={() => send.current({ type: 'snap' })} data-testid="sim-snap">
          <Camera size={16} /> Snapshot
        </button>
      </div>

      {hello && (
        <div className="envs" role="group" aria-label="Place">
          {hello.envs.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={hello.env === e.id}
              onClick={() => send.current({ type: 'env', env: e.id })}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
      {snapshot && (
        <img className="snap" src={snapshot} alt="Snapshot from the screen" data-testid="sim-snapshot" />
      )}
    </div>
  );
}
