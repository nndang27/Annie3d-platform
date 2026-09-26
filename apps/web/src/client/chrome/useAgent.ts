import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { t } from '../i18n';
import { sendAgentMessage } from '../lib/agentClient';
import { isDoc, withCloud } from '../lib/doc';
import { perfEnd, perfStart } from '../lib/perf';
import { applyRemote, useBoard } from '../store/board';
import { toast, useUi } from '../store/ui';
import type { AgentMessage } from './AgentDock';
import { attachRun } from './RunDialog';

/**
 * Agent conversation for the current board (F7): loads the latest thread, streams replies,
 * applies the agent's edits locally (already committed server-side, undoable with ⌘Z) and
 * follows any run it starts.
 */
export function useAgent() {
  const boardId = useBoard((s) => s.boardId);
  const mode = useBoard((s) => s.mode);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const thread = useRef<string | undefined>(undefined);

  useEffect(() => {
    setMessages([]);
    thread.current = undefined;
    if (mode !== 'remote' || !boardId) return;
    let cancelled = false;
    (async () => {
      const { threads } = await api.agentThreads(boardId);
      const latest = threads[0];
      if (!latest || cancelled) return;
      thread.current = latest.id;
      const { messages: rows } = await api.agentMessages(latest.id);
      if (cancelled) return;
      setMessages(
        rows.map((m) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'agent',
          text: m.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as { text: string }).text)
            .join(''),
          applied: m.parts
            .filter((p) => p.type === 'ops')
            .map((p) => ({ label: (p as { label: string }).label })),
        })),
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [boardId, mode]);

  const send = useCallback(
    async function send(text: string, budget: number, nodeIds: string[], ready = false): Promise<void> {
      // A board file first gets its working copy, with every result (the agent may read any).
      if (isDoc() && !ready)
        return withCloud(
          'save',
          { kind: 'agent' },
          () => void send(text, budget, [...useUi.getState().selected], true),
        );
      // Read at call time: a board file has just switched to its cloud copy (new id).
      const { mode, boardId } = useBoard.getState();
      if (mode === 'guest' || !boardId) {
        useUi.setState({ signInPrompt: { reason: 'save' } });
        return;
      }
      const agentId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'user', text },
        { id: agentId, role: 'agent', text: '', applied: [] },
      ]);
      setBusy(true);
      perfStart('agent.first');
      perfStart('agent.reply');
      const patch = (fn: (m: AgentMessage) => AgentMessage) =>
        setMessages((ms) => ms.map((m) => (m.id === agentId ? fn(m) : m)));
      try {
        await sendAgentMessage(
          boardId,
          { threadId: thread.current, content: text, budgetCredits: budget, context: { nodeIds } },
          (e) => {
            if (e.type === 'thread') thread.current = e.threadId;
            else if (e.type === 'text') {
              perfEnd('agent.first');
              patch((m) => ({ ...m, text: m.text + e.delta }));
            } else if (e.type === 'ops' && e.applied) {
              applyRemote(e.batch.ops, e.seq, { undoable: true });
              patch((m) => ({
                ...m,
                applied: [...(m.applied ?? []), { label: e.label ?? t('agent.boardEdited') }],
              }));
            } else if (e.type === 'run') attachRun(e.runId, queryClient);
            else if (e.type === 'error') toast(e.message, 'error');
          },
        );
      } catch (err) {
        patch((m) => ({ ...m, text: m.text || t('agent.failed', { message: (err as Error).message }) }));
      } finally {
        perfEnd('agent.reply');
        setBusy(false);
      }
    },
    [queryClient],
  );
  return { messages, busy, send };
}
