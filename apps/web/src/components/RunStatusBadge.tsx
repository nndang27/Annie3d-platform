import type { RunStatus } from '@3dads/contracts';
import { Badge } from '@3dads/ui';
import {
  AlertCircle,
  Check,
  CircleDashed,
  Clock,
  Loader2,
  MessageCircleQuestion,
  Pause,
  XCircle,
} from 'lucide-react';
import { en } from '@/i18n/en';

const TONE: Record<
  RunStatus,
  {
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'dark';
    pulse?: boolean;
    icon: typeof Check;
  }
> = {
  draft: { tone: 'neutral', icon: CircleDashed },
  queued: { tone: 'neutral', pulse: true, icon: Clock },
  running: { tone: 'accent', pulse: true, icon: Loader2 },
  waiting_input: { tone: 'warning', icon: MessageCircleQuestion },
  paused: { tone: 'warning', icon: Pause },
  cancelling: { tone: 'neutral', pulse: true, icon: Loader2 },
  completed: { tone: 'success', icon: Check },
  failed: { tone: 'danger', icon: AlertCircle },
  cancelled: { tone: 'neutral', icon: XCircle },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const t = TONE[status];
  const Icon = t.icon;
  return (
    <Badge tone={t.tone} pulse={t.pulse}>
      <Icon size={13} aria-hidden="true" />
      {en.run[status]}
    </Badge>
  );
}
