import { Color } from 'three';

/**
 * A colour of the app's design system (a CSS custom property on :root, apps/web app.css), so the
 * 3D views use the same surface and accent as the rest of the UI. `fallback` outside a page.
 */
export function uiColor(name: string, fallback: string): Color {
  const v =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(v || fallback);
}
