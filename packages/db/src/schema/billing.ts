import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, inList, pk, tstz, updatedAt } from './_shared';
import { users } from './auth';
import { runs } from './runs';
import { workspaces } from './workspaces';

export const CREDIT_REASONS = [
  'grant_free',
  'purchase',
  'subscription',
  'run_reserve',
  'run_settle',
  'run_refund',
  'adjust',
] as const;

/**
 * Credit balance per workspace. Changes are atomic conditional UPDATEs
 * (`SET balance = balance - $n WHERE balance >= $n`), never read-then-write, which avoids
 * lost updates under READ COMMITTED (postgres-best-practices, transaction-isolation.md).
 */
export const creditAccounts = pgTable(
  'credit_accounts',
  {
    workspaceId: uuid()
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    balance: bigint({ mode: 'number' }).notNull().default(0),
    reserved: bigint({ mode: 'number' }).notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'credit_accounts_balance_chk',
      sql`${t.balance} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.balance}`,
    ),
  ],
);

/** Append-only ledger; UPDATE and DELETE are blocked by a trigger (migration 0001). */
export const creditEntries = pgTable(
  'credit_entries',
  {
    id: pk(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    amount: integer().notNull(),
    reason: text().notNull(),
    runId: uuid().references(() => runs.id, { onDelete: 'set null' }),
    /** Payment provider event id or other external reference; unique → idempotent webhooks. */
    externalRef: text(),
    balanceAfter: bigint({ mode: 'number' }).notNull(),
    reservedAfter: bigint({ mode: 'number' }).notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    check('credit_entries_reason_chk', sql`${t.reason} IN (${inList(CREDIT_REASONS)})`),
    check(
      'credit_entries_nonzero',
      sql`${t.amount} <> 0 OR ${t.reason} IN ('run_reserve', 'run_settle', 'run_refund')`,
    ),
    uniqueIndex('credit_entries_external_ref_uq').on(t.externalRef).where(sql`${t.externalRef} IS NOT NULL`),
    index('credit_entries_workspace_recent_idx').on(t.workspaceId, t.createdAt.desc()),
    index('credit_entries_run_idx').on(t.runId),
    index('credit_entries_created_by_idx').on(t.createdBy),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: pk(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    providerCustomerId: text(),
    providerSubscriptionId: text().notNull(),
    plan: text().notNull(),
    status: text().notNull(),
    currentPeriodEnd: tstz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('subscriptions_provider_sub_uq').on(t.provider, t.providerSubscriptionId),
    check('subscriptions_provider_chk', sql`${t.provider} IN ('simulated', 'stripe', 'paddle')`),
    check('subscriptions_plan_chk', sql`${t.plan} IN ('creator', 'studio')`),
    check(
      'subscriptions_status_chk',
      sql`${t.status} IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')`,
    ),
    index('subscriptions_workspace_idx').on(t.workspaceId),
  ],
);

/** Webhook inbox: each provider event is recorded once, then processed (idempotency). */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: pk(),
    provider: text().notNull(),
    eventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: createdAt(),
    processedAt: tstz(),
  },
  (t) => [
    uniqueIndex('payment_events_provider_event_uq').on(t.provider, t.eventId),
    check('payment_events_provider_chk', sql`${t.provider} IN ('simulated', 'stripe', 'paddle')`),
  ],
);
