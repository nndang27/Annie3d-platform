export type RunStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting_input'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const TERMINAL_STATUSES: RunStatus[] = ['completed', 'failed', 'cancelled'];

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  draft: ['queued'],
  queued: ['running', 'cancelling', 'failed'],
  running: ['waiting_input', 'paused', 'cancelling', 'completed', 'failed'],
  waiting_input: ['running', 'cancelling'],
  paused: ['running', 'cancelling'],
  cancelling: ['cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface RunStep {
  nodeId: string;
  title: string;
  status: StepStatus;
  startedAt?: number;
  finishedAt?: number;
  /** Measured determinate progress only (units done / total), never elapsed-time guesses. */
  progress?: { done: number; total: number; unit: string };
  artifactId?: string;
  error?: string;
}

export interface Run {
  id: string;
  projectId: string;
  workflowId: string;
  workflowRevision: number;
  operationId: string;
  status: RunStatus;
  steps: RunStep[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  creditsReserved: number;
  creditsCharged: number;
  error?: string;
  /** Present when waiting_input. */
  inputRequest?: { question: string; options: string[]; nodeId: string };
  /** Answers already given, keyed by node id, so a resumed step does not ask again. */
  inputAnswers?: Record<string, string>;
  /** Set when the run was produced by retrying another run. */
  retryOf?: string;
  lastSeq: number;
}

export type RunEventType =
  | 'run.accepted'
  | 'run.started'
  | 'step.started'
  | 'step.progress'
  | 'step.completed'
  | 'step.failed'
  | 'artifact.created'
  | 'run.waiting_input'
  | 'run.resumed'
  | 'run.paused'
  | 'run.cancelling'
  | 'run.cancelled'
  | 'run.completed'
  | 'run.failed'
  | 'run.log';

export interface RunEvent {
  seq: number;
  runId: string;
  at: number;
  type: RunEventType;
  payload: Record<string, unknown>;
}

export interface EventReplay {
  events: RunEvent[];
  /** True when the requested cursor is older than the retained buffer; use `snapshot`. */
  gap: boolean;
  snapshot: Run;
  cursor: number;
}
