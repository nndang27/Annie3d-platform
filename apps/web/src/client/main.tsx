import './zod-setup';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initPerf } from './lib/perf';
import './app.css';
import { useBoard } from './store/board';
import { useUi } from './store/ui';

// Test/debug handle, dev builds only (tree-shaken from production by the DEV constant).
if (import.meta.env.DEV) Object.assign(window, { __annie3d: { useBoard, useUi } });
initPerf();

// F13 phone remote (`/sim/<room>`): a small page of its own, not the canvas.
const Controller = lazy(() => import('./sim/Controller'));
const remote = location.pathname.startsWith('/sim/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {remote ? (
      <Suspense fallback={null}>
        <Controller />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
