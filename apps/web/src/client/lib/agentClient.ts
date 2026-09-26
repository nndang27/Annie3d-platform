import type { GraphOp } from '@annie3d/contracts';
import { t } from '../i18n';

export type AgentEvent =
  | { type: 'thread'; threadId: string; messageId: string }
  | { type: 'text'; delta: string }
  | { type: 'ops'; batch: { opId: string; ops: GraphOp[] }; applied: boolean; seq?: number; label?: string }
  | { type: 'run'; runId: string }
  | { type: 'done'; usage: { credits: number } }
  | { type: 'error'; code: string; message: string };

/**
 * POST + Server-Sent Events over fetch (EventSource cannot POST a body). Parses `data:` lines
 * per the SSE spec and calls `onEvent` in order; resolves when the stream ends.
 */
export async function sendAgentMessage(
  boardId: string,
  body: { threadId?: string; content: string; budgetCredits: number; context: { nodeIds: string[] } },
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`/api/boards/${boardId}/agent/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message ?? t('canvas.agentUnavailable', { status: res.status }));
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i = buf.indexOf('\n\n');
    while (i >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(JSON.parse(data) as AgentEvent);
      i = buf.indexOf('\n\n');
    }
  }
}
