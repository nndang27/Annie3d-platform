/**
 * Scenario catalogue for the demo transport. Selected via /app/dev/scenarios, `?scenario=`,
 * localStorage `3dads.scenario`, or `window.__3dads.setScenario()` in tests.
 * Scenarios shape transport behaviour (latency, failures) and a few engine outcomes; they never
 * change domain rules such as idempotency or state transitions.
 */
export type ScenarioId =
  | 'normal'
  | 'slow'
  | 'offline'
  | 'flaky'
  | 'timeout'
  | 'run-failure'
  | 'partial-result'
  | 'waiting-input'
  | 'upload-reject'
  | 'expired-session'
  | 'denied-role'
  | 'missing-artifact'
  | 'payment-pending';

export interface ScenarioSpec {
  id: ScenarioId;
  title: string;
  description: string;
  /** What the tester should observe. */
  expect: string;
}

export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'normal',
    title: 'Normal',
    description: 'Representative latency (120–260 ms per call), runs complete.',
    expect: 'Runs finish with artifacts; no errors.',
  },
  {
    id: 'slow',
    title: 'Slow backend',
    description: 'Calls take 0.9–1.8 s; steps take 3–6 s.',
    expect: 'UI acknowledges immediately; content shows local pending state.',
  },
  {
    id: 'offline',
    title: 'Offline',
    description: 'Every call is rejected with a network error; subscriptions stop.',
    expect: 'Offline banner, local edits preserved, reconnect restores state and replays events.',
  },
  {
    id: 'flaky',
    title: 'Rate limited (429)',
    description: 'The first two calls of each kind return 429 with retry-after.',
    expect: 'Reads retry automatically; mutations show a retry action, no duplicates.',
  },
  {
    id: 'timeout',
    title: 'Timeout',
    description: 'Mutations hang for 8 s then time out.',
    expect: 'Timeout error with retry; a re-sent command with the same operation id does not duplicate.',
  },
  {
    id: 'run-failure',
    title: 'Run fails',
    description: 'The model build step fails at 60 %.',
    expect: 'Failed run with a specific error; retained artifacts stay; retry runs the failed step.',
  },
  {
    id: 'partial-result',
    title: 'Partial result',
    description: 'Model and scene succeed, animation fails.',
    expect: 'Successful outputs and the failed scope are shown together.',
  },
  {
    id: 'waiting-input',
    title: 'Waiting for input',
    description: 'The ad-variants step asks which layout to use.',
    expect: 'Run shows the exact question; answering resumes it.',
  },
  {
    id: 'upload-reject',
    title: 'Upload rejected',
    description: 'Uploads over 200 KB or non-image types are rejected.',
    expect: 'Field-level error naming the file, reason and limits; other fields kept.',
  },
  {
    id: 'expired-session',
    title: 'Expired session',
    description: 'The next authenticated call reports an expired session.',
    expect: 'Redirect to sign-in with returnTo; draft preserved.',
  },
  {
    id: 'denied-role',
    title: 'Permission denied',
    description: 'Mutations are refused as if the user were a viewer.',
    expect: 'Explanation of needed role and a realistic recovery route.',
  },
  {
    id: 'missing-artifact',
    title: 'Missing artifact',
    description: 'Artifact downloads and previews report not found.',
    expect: 'Missing-artifact state with recovery, no fake download.',
  },
  {
    id: 'payment-pending',
    title: 'Payment pending',
    description: 'Checkout success is confirmed only after a delayed callback.',
    expect: 'Return page shows pending, then confirmed; entitlement appears once.',
  },
];

export interface LatencyProfile {
  callMinMs: number;
  callMaxMs: number;
  stepMinMs: number;
  stepMaxMs: number;
  queueMs: number;
}

export const LATENCY: Record<'normal' | 'slow' | 'fast', LatencyProfile> = {
  normal: { callMinMs: 120, callMaxMs: 260, stepMinMs: 700, stepMaxMs: 1600, queueMs: 500 },
  slow: { callMinMs: 900, callMaxMs: 1800, stepMinMs: 3000, stepMaxMs: 6000, queueMs: 2000 },
  fast: { callMinMs: 0, callMaxMs: 20, stepMinMs: 60, stepMaxMs: 120, queueMs: 40 },
};

export function isScenarioId(v: unknown): v is ScenarioId {
  return typeof v === 'string' && SCENARIOS.some((s) => s.id === v);
}
