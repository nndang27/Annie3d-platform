import { net, type Session } from 'electron';
import { ORIGIN, WORKER_FIRST } from './config';

/**
 * Serve the site's pages and assets from the local web pack while keeping the real origin, so
 * cookies, Google sign-in, CSP and same-origin API calls behave exactly as on the website.
 * Everything else (the API, WebSocket upgrades are not intercepted at all, other hosts) goes to
 * the network untouched.
 */
export function interceptOrigin(session: Session, serve: (pathname: string) => Promise<Response | null>) {
  const scheme = new URL(ORIGIN).protocol.replace(':', '');
  session.protocol.handle(scheme, async (req) => {
    const u = new URL(req.url);
    if (
      u.origin === ORIGIN &&
      (req.method === 'GET' || req.method === 'HEAD') &&
      !WORKER_FIRST.test(u.pathname)
    ) {
      const res = await serve(u.pathname);
      if (res) return res;
    }
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });
}
