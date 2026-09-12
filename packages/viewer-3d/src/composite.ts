/** Draws the ad composition over a rendered frame. Shared by PNG export and poster generation. */
export interface CompositeInput {
  frame: ImageData;
  headline: string;
  subheadline: string;
  cta: string;
  brandColor: string;
  layout: 'text-left' | 'text-bottom' | 'centered';
  /** Text colour is chosen for contrast on the background luminance when omitted. */
  darkText?: boolean;
  label?: string;
}

export function compositeAd(input: CompositeInput): HTMLCanvasElement {
  const { frame } = input;
  const c = document.createElement('canvas');
  c.width = frame.width;
  c.height = frame.height;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(frame, 0, 0);
  const w = c.width;
  const h = c.height;
  const dark = input.darkText ?? isBright(frame);
  const text = dark ? '#17191d' : '#ffffff';
  const sub = dark ? '#505762' : 'rgba(255,255,255,0.82)';
  const pad = Math.round(w * 0.07);
  const headSize = Math.round(Math.min(w, h) * 0.075);
  const subSize = Math.round(headSize * 0.42);
  const ctaH = Math.round(headSize * 0.9);
  ctx.textBaseline = 'top';
  const font = (px: number, weight: number) =>
    `${weight} ${px}px Inter, ui-sans-serif, system-ui, sans-serif`;
  let x = pad;
  let y = pad;
  let align: CanvasTextAlign = 'left';
  let maxW = w * 0.5;
  if (input.layout === 'text-bottom') {
    y = h - pad - headSize * 1.15 - subSize * 1.6 - ctaH - headSize * 0.5;
    maxW = w - pad * 2;
  } else if (input.layout === 'centered') {
    align = 'center';
    x = w / 2;
    y = pad;
    maxW = w - pad * 2;
  }
  ctx.textAlign = align;
  ctx.fillStyle = text;
  ctx.font = font(headSize, 600);
  const lines = wrap(ctx, input.headline, maxW);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += headSize * 1.12;
  }
  ctx.fillStyle = sub;
  ctx.font = font(subSize, 400);
  for (const line of wrap(ctx, input.subheadline, maxW)) {
    ctx.fillText(line, x, y + subSize * 0.3);
    y += subSize * 1.5;
  }
  y += headSize * 0.5;
  // CTA pill
  ctx.font = font(Math.round(subSize * 1.05), 500);
  const ctaW = ctx.measureText(input.cta).width + ctaH * 1.2;
  let bx = x;
  if (align === 'center') bx = x - ctaW / 2;
  roundRect(ctx, bx, y, ctaW, ctaH, ctaH / 2);
  ctx.fillStyle = input.brandColor;
  ctx.fill();
  ctx.fillStyle = contrastOn(input.brandColor);
  ctx.textAlign = 'center';
  ctx.fillText(input.cta, bx + ctaW / 2, y + (ctaH - subSize * 1.05) / 2);
  if (input.label) {
    ctx.textAlign = 'right';
    ctx.font = font(Math.max(10, Math.round(subSize * 0.7)), 500);
    ctx.fillStyle = sub;
    ctx.fillText(input.label, w - pad * 0.5, h - pad * 0.5 - subSize * 0.7);
  }
  return c;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function isBright(frame: ImageData): boolean {
  // sample the corners
  const pts = [0, frame.width - 1, (frame.height - 1) * frame.width, frame.width * frame.height - 1];
  let lum = 0;
  for (const p of pts) {
    const i = p * 4;
    lum += 0.2126 * frame.data[i]! + 0.7152 * frame.data[i + 1]! + 0.0722 * frame.data[i + 2]!;
  }
  return lum / pts.length > 140;
}

export function contrastOn(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? '#17191d' : '#ffffff';
}
