export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  locale: 'en';
  createdAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  defaultAspect: AspectRatio;
  createdAt: number;
}

export interface Member {
  userId: string;
  workspaceId: string;
  role: Role;
  joinedAt: number;
  name: string;
  email: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: number;
  /** Simulated: the link is shown in the UI, never emailed. */
  simulatedLink: string;
}

export interface Session {
  token: string;
  userId: string;
  workspaceId: string;
  role: Role;
  expiresAt: number;
  /** Explicit mode label shown in the UI. */
  mode: 'demo';
}

export type AspectRatio = '1:1' | '4:5' | '9:16';
export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16'];
export function aspectToNumber(a: AspectRatio): number {
  switch (a) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '9:16':
      return 9 / 16;
  }
}
