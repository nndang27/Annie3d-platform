import { Banner, Button } from '@annie3d/ui';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { presentError } from '@/lib/errors';
import { useServices } from '@/services/context';

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const p = presentError(error);
  const services = useServices();
  const action =
    p.recovery === 'retry' && onRetry ? (
      <Button size="sm" onClick={onRetry}>
        Retry
      </Button>
    ) : p.recovery === 'reconnect' ? (
      <Button
        size="sm"
        onClick={() => {
          void services.connectivity.reconnect().then(() => onRetry?.());
        }}
      >
        Reconnect
      </Button>
    ) : p.recovery === 'signin' ? (
      <Link
        className="btn btn-secondary btn-sm"
        to="/signin"
        search={{ returnTo: window.location.pathname + window.location.search }}
      >
        Sign in
      </Link>
    ) : p.recovery === 'upgrade' ? (
      <Link className="btn btn-secondary btn-sm" to="/settings/billing">
        Usage & billing
      </Link>
    ) : p.recovery === 'back' ? (
      <Link className="btn btn-secondary btn-sm" to="/">
        Back to projects
      </Link>
    ) : null;
  return (
    <Banner
      tone={p.recovery === 'reconnect' ? 'warning' : 'danger'}
      title={compact ? undefined : p.title}
      icon={
        p.recovery === 'reconnect' ? (
          <WifiOff size={18} aria-hidden="true" />
        ) : (
          <AlertTriangle size={18} aria-hidden="true" />
        )
      }
      action={action}
    >
      {p.message}
    </Banner>
  );
}
