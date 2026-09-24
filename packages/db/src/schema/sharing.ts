import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, pk, tstz } from './_shared';
import { users } from './auth';
import { boards } from './boards';
import { workspaces } from './workspaces';

/** Share links (F10). Tokens are 128-bit random, base64url; revocation is a timestamp. */
export const shares = pgTable(
  'shares',
  {
    id: pk(),
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: uuid().notNull().references(() => boards.id, { onDelete: 'cascade' }),
    targetType: text().notNull(),
    targetId: uuid().notNull(),
    token: text().notNull().unique(),
    visibility: text().notNull().default('unlisted'),
    viewCount: bigint({ mode: 'number' }).notNull().default(0),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    revokedAt: tstz(),
  },
  (t) => [
    check('shares_target_chk', sql`${t.targetType} IN ('version', 'board')`),
    check('shares_visibility_chk', sql`${t.visibility} IN ('public', 'unlisted')`),
    check('shares_token_chk', sql`${t.token} ~ '^[A-Za-z0-9_-]{22,64}$'`),
    index('shares_board_idx').on(t.boardId),
    index('shares_workspace_idx').on(t.workspaceId),
    index('shares_created_by_idx').on(t.createdBy),
  ],
);
