import { sql } from 'drizzle-orm';
import type { Db } from './client';

/**
 * Credit ledger. `balance` = credits owned; `reserved` = held for running runs;
 * available = balance - reserved. Every change is one conditional UPDATE (no read-then-write)
 * plus one append-only entry, in a single transaction (postgres-best-practices,
 * transaction-isolation.md: "use atomic SQL" against lost updates).
 */
export type LedgerResult =
  | { ok: true; balance: number; reserved: number }
  | { ok: false; reason: 'insufficient' | 'duplicate' | 'no_account' };

export async function openAccount(db: Db, workspaceId: string, initial: number, externalRef: string | null) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO credit_accounts (workspace_id, balance, reserved) VALUES (${workspaceId}, 0, 0) ON CONFLICT DO NOTHING`,
    );
    if (initial > 0) return grant(tx as unknown as Db, workspaceId, initial, 'grant_free', externalRef, null);
    return { ok: true, balance: 0, reserved: 0 } as LedgerResult;
  });
}

/** Adds credits (purchase, subscription renewal, free grant). Idempotent on `externalRef`. */
export async function grant(
  db: Db,
  workspaceId: string,
  amount: number,
  reason: 'grant_free' | 'purchase' | 'subscription' | 'adjust',
  externalRef: string | null,
  actorId: string | null,
): Promise<LedgerResult> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive integer');
  return db.transaction(async (tx) => {
    if (externalRef) {
      const dup = await tx.execute(sql`SELECT 1 FROM credit_entries WHERE external_ref = ${externalRef}`);
      if (dup.rows.length) return { ok: false, reason: 'duplicate' } as const;
    }
    const upd = await tx.execute<{ balance: string; reserved: string }>(
      sql`UPDATE credit_accounts SET balance = balance + ${amount} WHERE workspace_id = ${workspaceId} RETURNING balance, reserved`,
    );
    const row = upd.rows[0];
    if (!row) return { ok: false, reason: 'no_account' } as const;
    // The unique index on external_ref still protects against a concurrent duplicate: the
    // INSERT fails and the whole transaction (including the UPDATE) rolls back.
    await tx.execute(sql`INSERT INTO credit_entries (workspace_id, amount, reason, external_ref, balance_after, reserved_after, created_by)
      VALUES (${workspaceId}, ${amount}, ${reason}, ${externalRef}, ${row.balance}, ${row.reserved}, ${actorId})`);
    return { ok: true, balance: Number(row.balance), reserved: Number(row.reserved) } as const;
  });
}

/** Holds credits for a run before any engine starts. Fails cleanly when not enough is available. */
export async function reserve(
  db: Db,
  workspaceId: string,
  runId: string,
  amount: number,
): Promise<LedgerResult> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('amount must be a non-negative integer');
  return db.transaction(async (tx) => {
    const upd = await tx.execute<{ balance: string; reserved: string }>(
      sql`UPDATE credit_accounts SET reserved = reserved + ${amount}
          WHERE workspace_id = ${workspaceId} AND balance - reserved >= ${amount}
          RETURNING balance, reserved`,
    );
    const row = upd.rows[0];
    if (!row) return { ok: false, reason: 'insufficient' } as const;
    await tx.execute(sql`INSERT INTO credit_entries (workspace_id, amount, reason, run_id, balance_after, reserved_after)
      VALUES (${workspaceId}, 0, 'run_reserve', ${runId}, ${row.balance}, ${row.reserved})`);
    return { ok: true, balance: Number(row.balance), reserved: Number(row.reserved) } as const;
  });
}

/** Releases the reservation and charges what the run actually used (≤ reserved). */
export async function settle(
  db: Db,
  workspaceId: string,
  runId: string,
  reserved: number,
  charged: number,
): Promise<LedgerResult> {
  if (charged > reserved || charged < 0) throw new Error('charged must be between 0 and reserved');
  return db.transaction(async (tx) => {
    const upd = await tx.execute<{ balance: string; reserved: string }>(
      sql`UPDATE credit_accounts SET balance = balance - ${charged}, reserved = reserved - ${reserved}
          WHERE workspace_id = ${workspaceId} AND reserved >= ${reserved}
          RETURNING balance, reserved`,
    );
    const row = upd.rows[0];
    if (!row) return { ok: false, reason: 'insufficient' } as const;
    await tx.execute(sql`INSERT INTO credit_entries (workspace_id, amount, reason, run_id, balance_after, reserved_after)
      VALUES (${workspaceId}, ${-charged}, 'run_settle', ${runId}, ${row.balance}, ${row.reserved})`);
    return { ok: true, balance: Number(row.balance), reserved: Number(row.reserved) } as const;
  });
}
