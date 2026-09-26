import { AlertCircle, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  createContext,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Button ---------- */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructive-solid';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  pill?: boolean;
  icon?: boolean;
  /** Explanation for an unavailable action; rendered as title and aria-describedby text. */
  disabledReason?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    pill,
    icon,
    className,
    disabled,
    disabledReason,
    children,
    type = 'button',
    onClick,
    ...rest
  },
  ref,
) {
  const unavailable = !!disabled || !!disabledReason;
  const reasonId = useId();
  return (
    <>
      <button
        ref={ref}
        type={type}
        className={cx(
          'btn',
          `btn-${variant}`,
          size !== 'md' && `btn-${size}`,
          pill && 'btn-pill',
          icon && 'btn-icon',
          loading && 'is-loading',
          className,
        )}
        aria-disabled={unavailable || loading ? true : undefined}
        aria-describedby={disabledReason ? reasonId : rest['aria-describedby']}
        aria-busy={loading || undefined}
        title={disabledReason ?? rest.title}
        onClick={(e) => {
          if (unavailable || loading) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
      {disabledReason ? (
        <span id={reasonId} className="visually-hidden">
          {disabledReason}
        </span>
      ) : null}
    </>
  );
});

/* ---------- Field / inputs ---------- */

export interface FieldProps {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, help, error, required, children, className }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [help ? helpId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('field', className)}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {help ? (
        <div id={helpId} className="field-help">
          {help}
        </div>
      ) : null}
      {error ? (
        <div id={errId} className="field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" style={{ marginTop: 2, flex: 'none' }} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { size?: never; small?: boolean }
>(function Input({ className, small, ...rest }, ref) {
  return <input ref={ref} className={cx('input', small && 'input-sm', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('textarea', className)} {...rest} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { small?: boolean }
>(function Select({ className, small, ...rest }, ref) {
  return <select ref={ref} className={cx('select', small && 'select-sm', className)} {...rest} />;
});

export function Switch({
  label,
  checked,
  onChange,
  description,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={description ? `${id}-d` : undefined}
      />
      <span className="switch-track" aria-hidden="true" />
      <span>
        <span style={{ display: 'block', fontSize: '0.9375rem' }}>{label}</span>
        {description ? (
          <span
            id={`${id}-d`}
            style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/* ---------- Segmented (radio group) ---------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="radiogroup" aria-label={label} className={cx('segmented', className)}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const dir =
              e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                  ? -1
                  : 0;
            if (!dir) return;
            e.preventDefault();
            const next = (i + dir + options.length) % options.length;
            onChange(options[next]!.value);
            refs.current[next]?.focus();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Tabs ---------- */

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; panelId?: string }[];
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className={cx('tabs', className)}>
      {tabs.map((t, i) => (
        <button
          key={t.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`tab-${t.value}`}
          aria-selected={t.value === value}
          aria-controls={t.panelId}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!dir) return;
            e.preventDefault();
            const next = (i + dir + tabs.length) % tabs.length;
            onChange(tabs[next]!.value);
            refs.current[next]?.focus();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Badge ---------- */

export function Badge({
  tone = 'neutral',
  children,
  pulse,
  className,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'dark';
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, className)}>
      {pulse ? <span className="dot pulse" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ---------- Banner ---------- */

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  icon,
  role,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success' | 'neutral';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div
      className={cx('banner', tone !== 'neutral' && `banner-${tone}`)}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
    >
      {icon}
      <div className="banner-body">
        {title ? <div className="banner-title">{title}</div> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <div className="empty-title">{title}</div>
      {children ? <div style={{ maxWidth: 440 }}>{children}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

/* ---------- Dialog (native <dialog>, focus restore) ---------- */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  description?: string;
  /** Prevent closing on Escape/backdrop while a mutation is in flight. */
  locked?: boolean;
  width?: number;
  /**
   * Text is the host app's (translated with its own `t`): the close button's name, and why it is
   * unavailable while `locked`.
   */
  closeLabel: string;
  lockedReason?: string;
}

export function Dialog(props: DialogProps) {
  // Closed dialogs render nothing: keeps the DOM small (lists render many cards) and keeps
  // hidden form controls out of the accessibility tree.
  if (!props.open) return null;
  return <OpenDialog {...props} />;
}

function OpenDialog({
  onClose,
  title,
  children,
  actions,
  description,
  locked,
  width,
  closeLabel,
  lockedReason,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    const first = d.querySelector<HTMLElement>(
      '[data-autofocus], input, textarea, select, button:not([data-close])',
    );
    first?.focus();
    return () => {
      if (d.open) d.close();
      restoreRef.current?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      style={width ? { maxWidth: `min(${width}px, calc(100vw - 32px))` } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
    >
      <div className="dialog-panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {description ? (
              <p id={descId} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="tertiary"
            icon
            size="sm"
            aria-label={closeLabel}
            data-close
            onClick={onClose}
            disabledReason={locked ? lockedReason : undefined}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        <div>{children}</div>
        {actions ? <div className="dialog-actions">{actions}</div> : null}
      </div>
    </dialog>
  );
}

/* ---------- Toasts ---------- */

export interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'success' | 'danger';
}

interface ToastApi {
  push(t: Omit<ToastItem, 'id'>): void;
}

const ToastCtx = createContext<ToastApi | null>(null);

/** `dismissLabel` names each toast's close button, in the host app's language. */
export function ToastProvider({ children, dismissLabel }: { children: ReactNode; dismissLabel: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++counter.current;
    setItems((list) => [...list.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), t.action ? 8000 : 4500);
  }, []);
  const api = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className="toast" role="status">
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="btn btn-tertiary btn-sm"
                onClick={() => {
                  t.action?.onClick();
                  setItems((l) => l.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-tertiary btn-sm btn-icon"
              aria-label={dismissLabel}
              onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ---------- Menu (click-to-open, keyboard navigable) ---------- */

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: ReactNode;
  disabledReason?: string;
}

export function Menu({
  trigger,
  items,
  label,
  align = 'end',
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode;
  items: (MenuItem | 'sep')[];
  label: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        (wrap.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const first = wrap.current?.querySelector<HTMLElement>('.menu-item');
    first?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align === 'end' ? 'right' : 'left']: 0,
            zIndex: 50,
          }}
          onKeyDown={(e) => {
            const els = Array.from(wrap.current?.querySelectorAll<HTMLElement>('.menu-item') ?? []);
            const i = els.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              els[(i + 1) % els.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              els[(i - 1 + els.length) % els.length]?.focus();
            }
          }}
        >
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={`sep-${i}`} className="menu-sep" role="separator" />
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={cx('menu-item', it.danger && 'is-danger')}
                aria-disabled={it.disabledReason ? true : undefined}
                title={it.disabledReason}
                onClick={() => {
                  if (it.disabledReason) return;
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Misc ---------- */

/** `label` is the host app's translated text (e.g. "Loading"). */
export function Spinner({ label }: { label: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Time since `ts` in the language `tag` (BCP 47, e.g. the app translator's `t.tag`). */
export function formatRelative(ts: number, tag = 'en', now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto', style: 'short' });
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return rtf.format(0, 'second');
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 30) return rtf.format(-d, 'day');
  return new Date(ts).toLocaleDateString(tag, { month: 'short', day: 'numeric' });
}

export function formatBytes(n?: number): string {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
