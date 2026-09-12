/** Virtual clock: real time plus an adjustable offset so tests can advance deterministically. */
export class VirtualClock {
  private offset = 0;
  private listeners = new Set<() => void>();
  now(): number {
    return Date.now() + this.offset;
  }
  advance(ms: number): void {
    this.offset += ms;
    for (const l of this.listeners) l();
  }
  reset(): void {
    this.offset = 0;
  }
  onAdvance(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
