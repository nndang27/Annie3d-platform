import './zod-setup';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLocale } from './i18n';
import { initPerf } from './lib/perf';
// Instrument Sans (OFL), self-hosted: only the upright weight axis (a variable font, latin subsets
// load on demand by unicode-range; CSP font-src 'self').
import '@fontsource-variable/instrument-sans/wght.css';
// Inter (OFL) for Vietnamese and Russian: declared here, downloaded only when those languages
// render (unicode-range + a family used only under :lang(vi) / :lang(ru)).
import '@fontsource-variable/inter/wght.css';
import './app.css';
import { useBoard } from './store/board';
import { useUi } from './store/ui';

// Test/debug handle, dev builds only (tree-shaken from production by the DEV constant).
if (import.meta.env.DEV) Object.assign(window, { __annie3d: { useBoard, useUi } });
initPerf();

// F13 phone remote (`/sim/<room>`): a small page of its own, not the canvas.
const Controller = lazy(() => import('./sim/Controller'));
const remote = location.pathname.startsWith('/sim/');

// The language's text is in before the first paint (English is built in: no wait).
void initLocale().then(() =>
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
  ),
);
