/** Cross-site links. In production preview both sites share one origin, so APP is '/app'. */
export const APP = `${import.meta.env.PUBLIC_APP_ORIGIN ?? ''}/app`;
export const appLink = (path = '', params: Record<string, string | undefined> = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const q = p.toString();
  return `${APP}${path}${q ? `?${q}` : ''}`;
};
export const NAV = [
  { href: '/product', label: 'Product' },
  { href: '/templates', label: 'Templates' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help' },
];
