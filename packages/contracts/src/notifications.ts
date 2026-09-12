export interface NotificationPrefs {
  runCompleted: { inApp: boolean; email: boolean };
  runFailed: { inApp: boolean; email: boolean };
  exportReady: { inApp: boolean; email: boolean };
  memberJoined: { inApp: boolean; email: boolean };
  weeklyDigest: { email: boolean };
}

export interface NotificationEntry {
  id: string;
  workspaceId: string;
  userId: string;
  at: number;
  kind: keyof NotificationPrefs;
  title: string;
  body: string;
  /** Simulated: 'in-app' entries are shown; 'email' entries are logged, never delivered. */
  channel: 'in-app' | 'email';
  read: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  runCompleted: { inApp: true, email: true },
  runFailed: { inApp: true, email: true },
  exportReady: { inApp: true, email: false },
  memberJoined: { inApp: true, email: false },
  weeklyDigest: { email: false },
};
