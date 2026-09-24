import { Button, Kbd } from '@annie3d/ui';
import { CornerDownLeft, Sparkles } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useComposerStore } from '@/stores/composerStore';
import { HELP_EXAMPLES, type Intent, parseIntent } from './intents';

export function Composer({
  onIntent,
  target,
  disabledReason,
}: {
  onIntent: (intent: Intent, raw: string) => Promise<string | undefined> | string | undefined;
  target: string;
  disabledReason?: string;
}) {
  const [value, setValue] = useState('');
  const results = useComposerStore((s) => s.results);
  const pushResult = useComposerStore((s) => s.pushResult);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const focusRequested = useComposerStore((s) => s.focusRequested);
  useEffect(() => {
    const t = useComposerStore.getState().consume();
    if (t) setValue((v) => `${v}${t}`);
    if (focusRequested) ta.current?.focus();
  }, [focusRequested]);
  const hintId = useId();

  const submit = async () => {
    const raw = value.trim();
    if (!raw || busy) return;
    const intent = parseIntent(raw);
    setValue('');
    if (intent.type === 'unsupported') {
      pushResult({ input: raw, ok: false, message: intent.reason, suggestions: intent.suggestions });
      return;
    }
    if (intent.type === 'help') {
      pushResult({
        input: raw,
        ok: true,
        message: 'Commands the demo composer understands:',
        suggestions: HELP_EXAMPLES,
      });
      return;
    }
    setBusy(true);
    try {
      const msg = await onIntent(intent, raw);
      pushResult({ input: raw, ok: true, message: msg ?? intent.summary });
    } catch (e) {
      pushResult({ input: raw, ok: false, message: (e as Error).message });
    } finally {
      setBusy(false);
      ta.current?.focus();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className={`composer${results.length ? ' has-results' : ''}`} data-testid="composer">
      {results.length ? (
        <ul
          style={{
            margin: '0 0 8px',
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 6,
            fontSize: '0.8125rem',
          }}
          aria-live="polite"
          aria-label="Composer results"
        >
          {results.map((r) => (
            <li
              key={r.id}
              style={{
                display: 'grid',
                gap: 2,
                padding: '6px 8px',
                borderRadius: 10,
                background: r.ok ? 'var(--bg-subtle)' : 'var(--warning-soft)',
              }}
              data-testid="composer-result"
              data-ok={r.ok}
            >
              <span style={{ color: 'var(--text-muted)' }}>› {r.input}</span>
              <span>{r.message}</span>
              {r.suggestions ? (
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {r.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="badge"
                      onClick={() => setValue(s)}
                      style={{ cursor: 'pointer', border: 0 }}
                    >
                      {s}
                    </button>
                  ))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <Sparkles size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={
            disabledReason ??
            'Tell the agent what to change — e.g. “Set background to charcoal” or “Run the workflow”'
          }
          aria-label={`Composer, affects ${target}`}
          aria-describedby={hintId}
          disabled={!!disabledReason}
          data-testid="composer-input"
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void submit()}
          loading={busy}
          disabledReason={disabledReason}
          aria-label="Send command"
          data-testid="composer-send"
        >
          <CornerDownLeft size={16} aria-hidden="true" />
        </Button>
      </div>
      <div
        id={hintId}
        className="composer-hint"
        style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}
      >
        <span>Affects: {target}</span>
        <span>
          <Kbd>Enter</Kbd> send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line
        </span>
        <span>Rule-based demo composer, not a language model.</span>
      </div>
    </div>
  );
}
