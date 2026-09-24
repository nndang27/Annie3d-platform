/**
 * Runs `fn` right after the next frame is painted (a rAF, then a task). Heavy setup such as a
 * WebGL context goes here so the click that opened an overlay paints it first: effects run
 * before paint after a discrete event, which put the context and environment map (~50 ms) inside
 * the click's interaction (web.dev, "Optimize Interaction to Next Paint": yield before heavy
 * work). Returns a cancel function.
 */
export function afterNextPaint(fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const raf = requestAnimationFrame(() => {
    timer = setTimeout(fn, 0);
  });
  return () => {
    cancelAnimationFrame(raf);
    if (timer !== undefined) clearTimeout(timer);
  };
}
