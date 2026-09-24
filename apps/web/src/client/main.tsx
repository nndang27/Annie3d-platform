import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Annie 3D canvas</main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
