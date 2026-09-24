import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, inList, pk, tstz, updatedAt } from './_shared';
import { users } from './auth';

export const PLANS = ['free', 'creator', 'studio'] as const;
export const ROLES = ['owner', 'editor', 'viewer'] as const;

/** Tenant. Every user gets a personal workspace at sign-up; teams come later without a schema change. */
export const workspaces = pgTable(
  'workspaces',
  {
    id: pk(),
    name: text().notNull(),
    plan: text().notNull().default('free'),
    /** Set when the one free full run has been used (F11). */
    freeRunUsedAt: tstz(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('workspaces_plan_chk', sql`${t.plan} IN (${inList(PLANS)})`),
    check('workspaces_name_len', sql`length(${t.name}) BETWEEN 1 AND 120`),
    index('workspaces_created_by_idx').on(t.createdBy),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid().notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    check('workspace_members_role_chk', sql`${t.role} IN (${inList(ROLES)})`),
    index('workspace_members_user_id_idx').on(t.userId),
  ],
);
