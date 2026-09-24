import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './_shared';
import { users } from './auth';
import { boards } from './boards';
import { workspaces } from './workspaces';

export const agentThreads = pgTable(
  'agent_threads',
  {
    id: pk(),
    boardId: uuid().notNull().references(() => boards.id, { onDelete: 'cascade' }),
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('agent_threads_board_idx').on(t.boardId, t.updatedAt.desc()), index('agent_threads_workspace_idx').on(t.workspaceId), index('agent_threads_created_by_idx').on(t.createdBy)],
);

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: pk(),
    threadId: uuid().notNull().references(() => agentThreads.id, { onDelete: 'cascade' }),
    role: text().notNull(),
    /** Structured content: text parts, applied op batches, run ids. */
    content: jsonb().notNull(),
    credits: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check('agent_messages_role_chk', sql`${t.role} IN ('user', 'assistant', 'tool')`),
    check('agent_messages_content_arr', sql`jsonb_typeof(${t.content}) = 'array'`),
    index('agent_messages_thread_idx').on(t.threadId, t.createdAt),
  ],
);
