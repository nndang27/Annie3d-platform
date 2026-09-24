/**
 * Calls `fn` at most once per animation frame with the latest arguments.
 * Adapted from Excalidraw `throttleRAF` (MIT), packages/common/src/utils.ts.
 */
export function throttleRAF<T extends unknown[]>(fn: (...args: T) => void) {
  let timerId: number | null = null;
  let lastArgs: T | null = null;
  const ret = (...args: T) => {
    lastArgs = args;
    if (timerId === null) {
      timerId = requestAnimationFrame(() => {
        timerId = null;
        const a = lastArgs;
        lastArgs = null;
        if (a) fn(...a);
      });
    }
  };
  ret.flush = () => {
    if (timerId !== null) cancelAnimationFrame(timerId);
    timerId = null;
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };
  ret.cancel = () => {
    if (timerId !== null) cancelAnimationFrame(timerId);
    timerId = null;
    lastArgs = null;
  };
  return ret;
}
