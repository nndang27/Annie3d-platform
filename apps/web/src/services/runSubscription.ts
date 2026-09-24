import { isTerminal, type Run, type RunEvent } from '@annie3d/contracts';
import { useEffect, useRef, useState } from 'react';
import { useServices } from './context';

export interface RunFeed {
  run: Run | null;
  events: RunEvent[];
  connection: 'live' | 'replaying' | 'offline' | 'idle';
  error: string | null;
}

const EVENT_WINDOW = 120;
const COALESCE_MS = 80;

/**
 * One subscription per mounted run. Progress ticks are coalesced into ≤ ~12 UI updates per second;
 * state transitions and terminal events are applied promptly. Reconnect replays from the cursor.
 * The backend owns the job; unmounting only stops listening.
 */
export function useRunSubscription(runId: string | undefined, onEvent?: (e: RunEvent) => void): RunFeed {
  const services = useServices();
  const [feed, setFeed] = useState<RunFeed>({ run: null, events: [], connection: 'idle', error: null });
  const cursor = useRef(0);
  const pendingProgress = useRef<Map<string, RunEvent>>(new Map());
  const flushTimer = useRef<number | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!runId) {
      setFeed({ run: null, events: [], connection: 'idle', error: null });
      return;
    }
    let disposed = false;
    let unsub: (() => void) | null = null;
    let snapshotInFlight = false;
    let snapshotAgain = false;
    cursor.current = 0;
    pendingProgress.current.clear();

    const applyProgress = () => {
      flushTimer.current = null;
      const batch = pendingProgress.current;
      if (batch.size === 0) return;
      pendingProgress.current = new Map();
      setFeed((f) => {
        if (!f.run) return f;
        const steps = f.run.steps.map((s) => {
          const e = batch.get(s.nodeId);
          if (!e || !s.progress) return s;
          return { ...s, progress: { ...s.progress, done: e.payload.done as number } };
        });
        return { ...f, run: { ...f.run, steps } };
      });
    };

    const fetchSnapshot = async () => {
      if (snapshotInFlight) {
        snapshotAgain = true;
        return;
      }
      snapshotInFlight = true;
      try {
        const run = await services.runs.get(runId);
        if (disposed) return;
        setFeed((f) => ({ ...f, run, connection: 'live', error: null }));
        if (run.lastSeq > cursor.current) cursor.current = run.lastSeq;
      } catch (e) {
        if (!disposed) setFeed((f) => ({ ...f, error: (e as Error).message }));
      } finally {
        snapshotInFlight = false;
        if (snapshotAgain && !disposed) {
          snapshotAgain = false;
          void fetchSnapshot();
        }
      }
    };

    const handle = (e: RunEvent) => {
      if (disposed || e.runId !== runId || e.seq <= cursor.current) return; // stale/duplicate
      cursor.current = e.seq;
      setFeed((f) => ({ ...f, events: [...f.events.slice(-(EVENT_WINDOW - 1)), e] }));
      onEventRef.current?.(e);
      if (e.type === 'step.progress') {
        pendingProgress.current.set(e.payload.nodeId as string, e);
        if (flushTimer.current === null) flushTimer.current = window.setTimeout(applyProgress, COALESCE_MS);
        return;
      }
      // Transition: apply the status immediately for terminal events, then reconcile with a snapshot.
      if (e.type === 'run.completed' || e.type === 'run.failed' || e.type === 'run.cancelled') {
        applyProgress();
        setFeed((f) =>
          f.run
            ? {
                ...f,
                run: {
                  ...f.run,
                  status:
                    e.type === 'run.completed'
                      ? 'completed'
                      : e.type === 'run.failed'
                        ? 'failed'
                        : 'cancelled',
                },
              }
            : f,
        );
      }
      void fetchSnapshot();
    };

    const subscribe = () => {
      unsub?.();
      setFeed((f) => ({ ...f, connection: 'replaying' }));
      unsub = services.runs.subscribe(
        runId,
        cursor.current,
        (e) => {
          handle(e);
          setFeed((f) => (f.connection === 'live' ? f : { ...f, connection: 'live' }));
        },
        (snapshot) => {
          if (disposed) return;
          cursor.current = snapshot.lastSeq;
          setFeed((f) => ({ ...f, run: snapshot, connection: 'live' }));
        },
      );
    };

    void (async () => {
      try {
        const run = await services.runs.get(runId);
        if (disposed) return;
        cursor.current = run.lastSeq;
        setFeed({ run, events: [], connection: isTerminal(run.status) ? 'idle' : 'replaying', error: null });
        if (!isTerminal(run.status)) subscribe();
        else setFeed((f) => ({ ...f, connection: 'live' }));
      } catch (e) {
        if (!disposed) setFeed((f) => ({ ...f, connection: 'offline', error: (e as Error).message }));
      }
    })();

    const unsubConn = services.connectivity.subscribe((state) => {
      if (disposed) return;
      if (state === 'offline') setFeed((f) => ({ ...f, connection: 'offline' }));
      if (state === 'online') {
        // Replay from the last seen cursor; a missed terminal event arrives here.
        void fetchSnapshot().then(() => {
          if (!disposed) subscribe();
        });
      }
    });

    return () => {
      disposed = true;
      unsub?.();
      unsubConn();
      if (flushTimer.current !== null) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
    };
  }, [runId, services]);

  return feed;
}
