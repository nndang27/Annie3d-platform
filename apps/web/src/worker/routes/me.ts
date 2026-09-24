import type { MeResponse } from '@annie3d/contracts';
import { creditAccounts, workspaces } from '@annie3d/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { requireUser } from '../lib/session';

export const me = new Hono<AppEnv>();

me.get('/api/me', requireUser, async (c) => {
  const db = getDb(c);
  const wsId = c.get('workspaceId')!;
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
  const [acc] = await db.select().from(creditAccounts).where(eq(creditAccounts.workspaceId, wsId));
  const u = c.get('user')!;
  const res: z.infer<typeof MeResponse> = {
    user: { id: u.id, name: u.name, email: u.email, image: u.image },
    workspace: { id: wsId, name: ws!.name, plan: ws!.plan as 'free', role: c.get('role')! },
    credits: {
      balance: acc?.balance ?? 0,
      reserved: acc?.reserved ?? 0,
      freeRunAvailable: !ws!.freeRunUsedAt,
    },
  };
  return c.json(res);
});
