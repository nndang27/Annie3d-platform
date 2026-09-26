import type { Graph, GraphOp } from '@annie3d/contracts';
import type { Locale } from '../lib/i18n';

/**
 * AGENT PLUG POINT (F7). An agent turns one user message into a stream of actions:
 * streamed text, board edits (ordinary op batches, applied through the same reducer and op
 * log as a person's edits), and runs. The route applies ops, enforces the credit budget and
 * streams everything to the dock over SSE. A real LLM agent implements the same interface.
 */
export type AgentAction =
  | { type: 'text'; delta: string }
  | { type: 'ops'; ops: GraphOp[]; label: string }
  | { type: 'run'; nodeId: string | null; scope: 'node' | 'from_here' | 'with_upstream' | 'all' };

export interface AgentInput {
  message: string;
  graph: Graph;
  /** Nodes the user selected (context chips). */
  nodeIds: string[];
  budgetCredits: number;
  history: { role: 'user' | 'assistant'; text: string }[];
  /**
   * The person's language (cookie, then Accept-Language): answer and name changes (op labels)
   * in it. An LLM agent tells the model to reply in this language (LOCALES in @annie3d/i18n
   * has its name); board content people typed stays as it is.
   */
  locale: Locale;
}

export interface Agent {
  id: string;
  respond(input: AgentInput): AsyncGenerator<AgentAction>;
}
