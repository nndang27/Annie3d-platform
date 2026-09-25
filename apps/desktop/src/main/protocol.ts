import { net, type Session } from 'electron';
import { WORKER_FIRST } from './config';

/**
 * Serve the site's pages and assets from the local web pack while keeping the real origin, so
 * cookies, Google sign-in, CSP and same-origin API calls behave exactly as on the website.
 * Everything else (the API, WebSocket upgrades are not intercepted at all, other hosts) goes to
 * the network untouched.
 */
export function interceptOrigin(
  session: Session,
  origin: string,
  serve: (pathname: string, req: Request) => Promise<Response | null>,
) {
  const scheme = new URL(origin).protocol.replace(':', '');
  session.protocol.handle(scheme, async (req) => {
    const u = new URL(req.url);
    if (
      u.origin === origin &&
      (req.method === 'GET' || req.method === 'HEAD') &&
      !WORKER_FIRST.test(u.pathname)
    ) {
      const res = await serve(u.pathname, req);
      if (res) return res;
    }
    // Handled http:// requests (the dev server) reach here without their Origin header, which
    // sign-in requires (measured: 403 MISSING_OR_NULL_ORIGIN; https keeps it). Requests to our
    // own origin come from our own pages, so the origin is ours.
    if (u.origin === origin && !['GET', 'HEAD'].includes(req.method) && !req.headers.has('origin')) {
      const headers = new Headers(req.headers);
      headers.set('origin', origin);
      const body = req.body ? await req.arrayBuffer() : undefined;
      return net.fetch(req.url, { method: req.method, headers, body, bypassCustomProtocolHandlers: true });
    }
    return net.fetch(req, { bypassCustomProtocolHandlers: true });
  });
}
