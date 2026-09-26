import { NODE_DEFS } from '@annie3d/contracts';
import { ArrowUp, Check, X } from 'lucide-react';
import { useState } from 'react';
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
  'Make the stage warmer and add a 6-second cut',
  'Add a packshot with four angles',
  'Use a softer light on the 3D model',
];

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
  const open = useUi((s) => s.agentOpen);
  const selected = useUi((s) => s.selected);
  const nodes = useBoard((s) => s.graph.nodes);
  const [text, setText] = useState('');
  const [budget, setBudget] = useState(100);
  if (!open) return null;
  const chips = [...selected].map((id) => nodes.get(id)).filter((n) => !!n);
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend?.(
      t,
      budget,
      chips.map((n) => n.id),
    );
    setText('');
  };
  return (
    <aside className="agent" aria-label="Ask Annie" data-testid="agent-dock" data-busy={busy}>
      <header>
        Ask Annie
        <button
          type="button"
          className="icon-btn close"
          aria-label="Close agent"
          onClick={() => useUi.setState({ agentOpen: false })}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="msgs" aria-live="polite">
        {messages.length === 0 ? (
          // Right above the box they fill: what Annie does, and changes to start from.
          <div className="empty">
            <p>Annie changes this board for you: nodes, settings and wires. ⌘Z undoes her edits.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((t) => (
                <button key={t} type="button" onClick={() => setText(t)} data-testid="agent-suggestion">
                  {t}
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
                      <span key={`${a.label}-${i}`} className="op-chip" title="Undo with ⌘Z">
                        <Check size={12} aria-hidden="true" /> {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
        )}
        {busy && !messages.at(-1)?.text && <div className="msg msg-agent typing">Thinking…</div>}
      </div>
      <div className="composer">
        {chips.length > 0 && (
          <div className="chips">
            {chips.slice(0, 6).map((n) => (
              <span key={n.id} className="chip">
                {n.label ?? NODE_DEFS[n.kind].label}
              </span>
            ))}
            {chips.length > 6 && <span className="chip">+{chips.length - 6}</span>}
          </div>
        )}
        <textarea
          aria-label="Message the agent"
          placeholder="Describe a change…"
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
            Budget{' '}
            <select
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Budget in credits"
            >
              {[25, 50, 100, 200].map((b) => (
                <option key={b} value={b}>
                  {b} credits
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="send"
            aria-label="Send"
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
