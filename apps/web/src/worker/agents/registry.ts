import type { Env } from '../env';
import { simulatedAgent } from './simulated';
import type { Agent } from './types';

/** Swap in the real agent here (e.g. a Claude tool-use loop producing the same actions). */
export function agentFor(_env: Env): Agent {
  return simulatedAgent;
}
