import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app.css';
import { useBoard } from './store/board';
import { useUi } from './store/ui';

// Test/debug handle, dev builds only (tree-shaken from production by the DEV constant).
if (import.meta.env.DEV) Object.assign(window, { __annie3d: { useBoard, useUi } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
