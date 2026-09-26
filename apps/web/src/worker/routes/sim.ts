import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { httpError } from '../lib/http';

export const simRoutes = new Hono<AppEnv>();

/**
 * F13 remote link: the simulation screen and the phones that control it meet in a SimRoom.
 * No account is needed on the phone; the room id (≥ 128 random bits) is the capability.
 */
simRoutes.get('/api/sim/:room/ws', async (c) => {
  const room = c.req.param('room');
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(room)) throw httpError(400, 'bad_request', 'api.sim.badRoom');
  if (c.req.header('upgrade') !== 'websocket')
    throw httpError(426 as 400, 'bad_request', 'api.http.expectedWebSocket');
  const stub = c.env.SIM_ROOM.get(c.env.SIM_ROOM.idFromName(room));
  return stub.fetch(c.req.raw);
});
