import type { Session } from '@3dads/contracts';
import { create } from 'zustand';

interface SessionState {
  session: Session | null;
  hydrated: boolean;
  setSession(s: Session | null): void;
}

/** Synchronous view of the session for route guards; hydrated once at bootstrap. */
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session, hydrated: true }),
}));
