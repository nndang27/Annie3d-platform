/** Bounded undo/redo history around an immutable document. */
export interface Undoable<T> {
  present: T;
  past: T[];
  future: T[];
  /** Revision the document was last saved at (present === saved when clean). */
  savedPresent: T | null;
}

export const HISTORY_LIMIT = 100;

export function initUndoable<T>(present: T): Undoable<T> {
  return { present, past: [], future: [], savedPresent: present };
}

export function commit<T>(u: Undoable<T>, next: T): Undoable<T> {
  if (next === u.present) return u;
  const past = [...u.past, u.present];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { ...u, present: next, past, future: [] };
}

/** Replace present without a history entry (e.g. continuous slider drag before commit). */
export function replace<T>(u: Undoable<T>, next: T): Undoable<T> {
  return { ...u, present: next };
}

export function undo<T>(u: Undoable<T>): Undoable<T> {
  const prev = u.past[u.past.length - 1];
  if (prev === undefined) return u;
  return { ...u, present: prev, past: u.past.slice(0, -1), future: [u.present, ...u.future] };
}

export function redo<T>(u: Undoable<T>): Undoable<T> {
  const next = u.future[0];
  if (next === undefined) return u;
  return { ...u, present: next, past: [...u.past, u.present], future: u.future.slice(1) };
}

export function markSaved<T>(u: Undoable<T>): Undoable<T> {
  return { ...u, savedPresent: u.present };
}

export function isDirty<T>(u: Undoable<T>): boolean {
  return u.savedPresent !== u.present;
}
