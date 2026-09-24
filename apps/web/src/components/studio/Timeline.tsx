import type { SceneDoc } from '@annie3d/contracts';
import { Button, Select } from '@annie3d/ui';
import { Pause, Play, SkipBack } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@/stores/sceneStore';
import type { ViewerHandle } from './ViewerPanel';

export function Timeline({
  viewer,
  scene,
  readOnly,
  timeSource,
}: {
  viewer: React.RefObject<ViewerHandle | null>;
  scene: SceneDoc;
  readOnly: boolean;
  timeSource: React.MutableRefObject<{ t: number; playing: boolean }>;
}) {
  const edit = useSceneStore((s) => s.edit);
  const [display, setDisplay] = useState({ t: 0, playing: false });
  const scrubbing = useRef(false);
  // Readout polls the time ref at 10 Hz while playing: no per-frame React updates.
  useEffect(() => {
    const id = window.setInterval(() => {
      const src = timeSource.current;
      if (!scrubbing.current)
        setDisplay((d) =>
          d.t !== src.t || d.playing !== src.playing ? { t: src.t, playing: src.playing } : d,
        );
    }, 100);
    return () => window.clearInterval(id);
  }, [timeSource]);
  const dur = scene.animation.durationSec;
  return (
    <div className="timeline" data-testid="timeline">
      <Button
        variant="primary"
        icon
        size="sm"
        aria-label={display.playing ? 'Pause' : 'Play'}
        onClick={() => {
          if (display.playing) viewer.current?.pause();
          else viewer.current?.play();
          const v = viewer.current;
          if (v) setDisplay((d) => ({ ...d, playing: v.isPlaying() }));
        }}
        data-testid="play-toggle"
        aria-pressed={display.playing}
      >
        {display.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </Button>
      <Button
        variant="tertiary"
        icon
        size="sm"
        aria-label="Back to start"
        onClick={() => viewer.current?.seek(0)}
      >
        <SkipBack size={16} aria-hidden="true" />
      </Button>
      <input
        type="range"
        min={0}
        max={dur}
        step={0.05}
        value={display.t}
        aria-label="Animation time"
        aria-valuetext={`${display.t.toFixed(1)} of ${dur} seconds`}
        onPointerDown={() => {
          scrubbing.current = true;
        }}
        onPointerUp={() => {
          scrubbing.current = false;
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          setDisplay((d) => ({ ...d, t: v }));
          viewer.current?.seek(v);
        }}
        data-testid="scrubber"
      />
      <span
        className="numeric"
        style={{ fontSize: '0.8125rem', width: 84, textAlign: 'right' }}
        data-testid="time-readout"
      >
        {display.t.toFixed(1)} / {dur.toFixed(1)} s
      </span>
      <Select
        small
        aria-label="Animation preset"
        value={scene.animation.preset}
        onChange={(e) =>
          edit({
            scene: {
              animation: {
                preset: e.target.value as SceneDoc['animation']['preset'],
              } as SceneDoc['animation'],
            },
          })
        }
        disabled={readOnly}
        style={{ width: 130 }}
        data-testid="animation-preset"
      >
        <option value="turntable">Turntable</option>
        <option value="orbit-sweep">Orbit sweep</option>
        <option value="dolly-in">Dolly in</option>
      </Select>
      <Select
        small
        aria-label="Duration"
        value={String(dur)}
        onChange={(e) =>
          edit({ scene: { animation: { durationSec: Number(e.target.value) } as SceneDoc['animation'] } })
        }
        disabled={readOnly}
        style={{ width: 84 }}
        data-testid="duration-select"
      >
        {[3, 4, 6, 8, 10, 12, 15].map((d) => (
          <option key={d} value={d}>
            {d} s
          </option>
        ))}
      </Select>
    </div>
  );
}
