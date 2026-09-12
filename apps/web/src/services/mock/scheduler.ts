import type { VirtualClock } from './clock';

export interface ScheduledTask<P = Record<string, unknown>> {
  id: string;
  dueAt: number;
  kind: string;
  payload: P;
}

/**
 * Persisted scheduler: tasks live in serialisable state (so a reload reconstructs them),
 * one real timer wakes for the earliest task, and clock.advance() runs due tasks synchronously.
 * Simulated backend work is owned here, never by a mounted component.
 */
export class PersistedScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Map<string, (task: ScheduledTask) => void>();
  private running = false;
  private seq = 0;
  /** dueAt of the task currently executing; successors are scheduled relative to it so a backlog catches up. */
  private executingAt: number | null = null;

  constructor(
    private clock: VirtualClock,
    private tasks: () => ScheduledTask[],
    private setTasks: (t: ScheduledTask[]) => void,
    private onIdle?: () => void,
  ) {
    clock.onAdvance(() => this.runDue());
  }

  on(kind: string, handler: (task: ScheduledTask) => void): void {
    this.handlers.set(kind, handler);
  }

  schedule(kind: string, delayMs: number, payload: Record<string, unknown>): ScheduledTask {
    this.seq += 1;
    const base = this.executingAt ?? this.clock.now();
    const task: ScheduledTask = {
      id: `task_${base.toString(36)}_${this.seq}`,
      dueAt: base + Math.max(0, delayMs),
      kind,
      payload,
    };
    this.setTasks([...this.tasks(), task].sort((a, b) => a.dueAt - b.dueAt));
    this.arm();
    return task;
  }

  cancelWhere(pred: (t: ScheduledTask) => boolean): number {
    const before = this.tasks();
    const after = before.filter((t) => !pred(t));
    this.setTasks(after);
    this.arm();
    return before.length - after.length;
  }

  pending(): ScheduledTask[] {
    return this.tasks();
  }

  /** Run every task whose dueAt has passed, in order; tasks may schedule successors. */
  runDue(): void {
    if (this.running) return;
    this.running = true;
    try {
      let guard = 0;
      while (guard++ < 10_000) {
        const list = this.tasks();
        const next = list[0];
        if (!next || next.dueAt > this.clock.now()) break;
        this.setTasks(list.slice(1));
        const h = this.handlers.get(next.kind);
        this.executingAt = next.dueAt;
        try {
          if (h) h(next);
        } finally {
          this.executingAt = null;
        }
      }
    } finally {
      this.running = false;
      this.arm();
      if (this.tasks().length === 0) this.onIdle?.();
    }
  }

  arm(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const next = this.tasks()[0];
    if (!next) return;
    const delay = Math.max(0, next.dueAt - this.clock.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runDue();
    }, delay);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
