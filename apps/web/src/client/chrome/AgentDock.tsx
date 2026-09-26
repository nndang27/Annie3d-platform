import { ArrowUp, Check, X } from 'lucide-react';
import { useState } from 'react';
import { nodeName, useT } from '../i18n';
import { useBoard } from '../store/board';
import { useUi } from '../store/ui';
import { useAgent } from './useAgent';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  /** Op batches the agent applied, shown as undoable chips. */
  applied?: { label: string }[];
}

const SUGGESTIONS = [
  'agent.suggestion.warmerStage',
  'agent.suggestion.fourAngles',
  'agent.suggestion.softerLight',
] as const;

/**
 * Right dock (F7). The composer carries a budget and the selected nodes as context chips.
 * Messages stream over SSE (`POST /api/boards/:id/agent/messages`, see useAgent).
 */
export function AgentDock() {
  const { messages, busy, send: onSend } = useAgent();
  return <AgentDockView messages={messages} onSend={onSend} busy={busy} />;
}

export function AgentDockView({
  messages = [],
  onSend,
  busy = false,
}: {
  messages?: AgentMessage[];
  onSend?: (text: string, budget: number, nodeIds: string[]) => void;
  busy?: boolean;
}) {
  const t = useT();
  const open = useUi((s) => s.agentOpen);
  const selected = useUi((s) => s.selected);
  const nodes = useBoard((s) => s.graph.nodes);
  const [text, setText] = useState('');
  const [budget, setBudget] = useState(100);
  if (!open) return null;
  const chips = [...selected].map((id) => nodes.get(id)).filter((n) => !!n);
  const send = () => {
    const msg = text.trim();
    if (!msg || busy) return;
    onSend?.(
      msg,
      budget,
      chips.map((n) => n.id),
    );
    setText('');
  };
  return (
    <aside className="agent" aria-label={t('agent.title')} data-testid="agent-dock" data-busy={busy}>
      <header>
        {t('agent.title')}
        <button
          type="button"
          className="icon-btn close"
          aria-label={t('agent.close')}
          onClick={() => useUi.setState({ agentOpen: false })}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="msgs" aria-live="polite">
        {messages.length === 0 ? (
          // Right above the box they fill: what Annie does, and changes to start from.
          <div className="empty">
            <p>{t('agent.intro')}</p>
            <div className="suggestions">
              {SUGGESTIONS.map((k) => (
                <button key={k} type="button" onClick={() => setText(t(k))} data-testid="agent-suggestion">
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages
            .filter((m) => m.text || m.applied?.length)
            .map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`} data-testid={`msg-${m.role}`}>
                {m.text}
                {!!m.applied?.length && (
                  <div className="op-chips">
                    {m.applied.map((a, i) => (
                      <span key={`${a.label}-${i}`} className="op-chip" title={t('agent.undoHint')}>
                        <Check size={12} aria-hidden="true" /> {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
        )}
        {busy && !messages.at(-1)?.text && <div className="msg msg-agent typing">{t('agent.thinking')}</div>}
      </div>
      <div className="composer">
        {chips.length > 0 && (
          <div className="chips">
            {chips.slice(0, 6).map((n) => (
              <span key={n.id} className="chip">
                {nodeName(t, n)}
              </span>
            ))}
            {chips.length > 6 && <span className="chip">+{chips.length - 6}</span>}
          </div>
        )}
        <textarea
          aria-label={t('agent.input')}
          placeholder={t('agent.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          data-testid="agent-input"
        />
        <div className="row">
          <label>
            {t('agent.budget')}{' '}
            <select
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label={t('agent.budgetLabel')}
            >
              {[25, 50, 100, 200].map((b) => (
                <option key={b} value={b}>
                  {t('common.credits', { count: b })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="send"
            aria-label={t('agent.send')}
            onClick={send}
            disabled={busy || !text.trim()}
            data-testid="agent-send"
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
