import './app.css';
import { isRetryable } from '@3dads/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from '@/router';
import { createServices, resolveMode } from '@/services/bootstrap';
import { ServicesProvider } from '@/services/context';
import { installDevtools } from '@/services/devtools';
import { createQueryClient } from '@/services/queries';
import { useSessionStore } from '@/stores/sessionStore';

performance.mark('app:boot');

async function boot() {
  const mode = resolveMode();
  const services = await createServices(mode);
  const queryClient = createQueryClient();
  installDevtools(services, queryClient);
  // Transient transport failures (429, network blips) must not log the user out at boot.
  let session = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      session = await services.session.current();
      break;
    } catch (e) {
      if (!isRetryable(e) || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 150 * 2 ** attempt));
    }
  }
  useSessionStore.getState().setSession(session);
  performance.mark('app:services-ready');
  performance.measure('app:bootstrap', 'app:boot', 'app:services-ready');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ServicesProvider>
    </StrictMode>,
  );
}

void boot().catch((e: Error) => {
  const root = document.getElementById('root')!;
  root.innerHTML = `<div style="font-family:system-ui;padding:32px;max-width:560px"><h1 style="font-size:20px">3Dads could not start</h1><p style="color:#505762">${escapeHtml(e.message)}</p><p><a href="/app/">Reload</a></p></div>`;
});

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
