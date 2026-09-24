import { AgentMessageRequest, type GraphOp } from '@annie3d/contracts';
import { agentMessages, agentThreads, createDb } from '@annie3d/db';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { agentFor } from '../agents/registry';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { body, httpError, uuidParam } from '../lib/http';
import { requireEditor, requireUser } from '../lib/session';
import { applyBatch, loadBoard, loadGraph } from '../services/boards';
import { startGraphRun } from './runs';

export const agentRoutes = new Hono<AppEnv>();

type Part =
  | { type: 'text'; text: string }
  | { type: 'ops'; label: string; opId: string; seq: number }
  | { type: 'run'; runId: string };

/**
 * F7: one message → Server-Sent Events of text, applied op batches and runs.
 * Ops go through applyBatch (same reducer, lock and op log as a person's edits), runs through
 * the normal run path, capped by the message's credit budget. The thread is stored so the
 * dock shows history and a real agent gets context.
 */
agentRoutes.post('/api/boards/:boardId/agent/messages', requireEditor, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const req = await body(c, AgentMessageRequest);
  const ws = c.get('workspaceId')!;
  const user = c.get('user')!;
  const lim = await c.env.RL_WRITE.limit({ key: user.id });
  if (!lim.success) throw httpError(429, 'rate_limited', 'Too many messages. Wait a minute.');
  const db = getDb(c);
  await loadBoard(db, ws, boardId);
  let threadId = req.threadId;
  if (threadId) {
    const t = await db.query.agentThreads.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, threadId!), eq(t.boardId, boardId)),
    });
    if (!t) throw httpError(404, 'not_found', 'Thread not found');
  } else {
    const [t] = await db
      .insert(agentThreads)
      .values({ boardId, workspaceId: ws, title: req.content.slice(0, 80), createdBy: user.id })
      .returning();
    threadId = t!.id;
  }
  const history = (
    await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.threadId, threadId))
      .orderBy(desc(agentMessages.createdAt))
      .limit(12)
  )
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: (m.content as Part[])
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text)
        .join(''),
    }));
  await db.insert(agentMessages).values({
    threadId,
    role: 'user',
    content: [
      { type: 'text', text: req.content },
      { type: 'context', nodeIds: req.context.nodeIds },
    ],
  });
  const { graph } = await loadGraph(db, boardId);
  const agent = agentFor(c.env);
  const messageId = crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    // The request's pg client is closed by closeDb as soon as the streaming response starts;
    // the stream gets its own connection for its whole lifetime.
    const { db: sdb, client } = createDb(c.env.HYPERDRIVE.connectionString);
    await client.connect();
    const parts: Part[] = [];
    let text = '';
    let credits = 0;
    const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) });
    await send({ type: 'thread', threadId, messageId });
    try {
      for await (const a of agent.respond({
        message: req.content,
        graph,
        nodeIds: req.context.nodeIds,
        budgetCredits: req.budgetCredits,
        history,
      })) {
        if (stream.aborted) break;
        if (a.type === 'text') {
          text += a.delta;
          await send(a);
        } else if (a.type === 'ops') {
          const opId = crypto.randomUUID();
          try {
            const res = await applyBatch(sdb, ws, user.id, boardId, opId, a.ops);
            parts.push({ type: 'ops', label: a.label, opId, seq: res.seq });
            await send({
              type: 'ops',
              batch: { opId, ops: a.ops as GraphOp[] },
              applied: true,
              seq: res.seq,
              label: a.label,
            });
          } catch (e) {
            await send({ type: 'ops', batch: { opId, ops: a.ops }, applied: false, label: a.label });
            const msg = ` (Could not apply “${a.label}”: ${(e as Error).message})`;
            text += msg;
            await send({ type: 'text', delta: msg });
          }
        } else if (a.type === 'run') {
          const r = await startGraphRun(
            c,
            sdb,
            boardId,
            a.nodeId,
            a.scope,
            crypto.randomUUID(),
            req.budgetCredits,
          ).catch((e: Error & { code?: string }) => ({ error: e }));
          let note = '';
          if ('runId' in r) {
            credits += r.credits;
            parts.push({ type: 'run', runId: r.runId });
            await send({ type: 'run', runId: r.runId });
          } else if ('upToDate' in r) note = ' Everything is already up to date, so nothing ran.';
          else if ('overBudget' in r)
            note = ` That run needs ${r.overBudget} credits, more than this message's budget of ${req.budgetCredits}. Raise the budget and ask again.`;
          else note = ` I could not start the run: ${r.error.message}`;
          if (note) {
            text += note;
            await send({ type: 'text', delta: note });
          }
        }
      }
      await send({ type: 'done', usage: { credits } });
    } catch (e) {
      await send({ type: 'error', code: 'internal', message: (e as Error).message });
    } finally {
      await sdb.insert(agentMessages).values({
        id: messageId,
        threadId: threadId!,
        role: 'assistant',
        content: [{ type: 'text', text }, ...parts],
        credits,
      });
      await sdb.update(agentThreads).set({ updatedAt: new Date() }).where(eq(agentThreads.id, threadId!));
      await client.end().catch(() => {});
    }
  });
});

agentRoutes.get('/api/boards/:boardId/agent/threads', requireUser, async (c) => {
  const boardId = uuidParam(c, 'boardId');
  const db = getDb(c);
  await loadBoard(db, c.get('workspaceId')!, boardId);
  const rows = await db
    .select()
    .from(agentThreads)
    .where(eq(agentThreads.boardId, boardId))
    .orderBy(desc(agentThreads.updatedAt))
    .limit(20);
  return c.json({
    threads: rows.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt.toISOString() })),
  });
});

agentRoutes.get('/api/agent/threads/:threadId/messages', requireUser, async (c) => {
  const threadId = uuidParam(c, 'threadId');
  const db = getDb(c);
  const t = await db.query.agentThreads.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, threadId), eq(t.workspaceId, c.get('workspaceId')!)),
  });
  if (!t) throw httpError(404, 'not_found', 'Thread not found');
  const rows = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.threadId, threadId))
    .orderBy(agentMessages.createdAt)
    .limit(200);
  return c.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      parts: (m.content as Part[]).filter((p) => p.type !== ('context' as string)),
      credits: m.credits,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});
