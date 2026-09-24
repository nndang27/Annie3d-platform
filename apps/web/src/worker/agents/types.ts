import type { Graph, GraphOp } from '@annie3d/contracts';

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
}

export interface Agent {
  id: string;
  respond(input: AgentInput): AsyncGenerator<AgentAction>;
}
