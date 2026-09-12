export type PlanId = 'starter' | 'studio' | 'team';
export type BillingInterval = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Illustrative USD prices for the demonstration. */
  monthlyUsd: number;
  yearlyUsd: number;
  creditsPerMonth: number;
  seats: number;
  maxProjects: number | 'unlimited';
  exportPresets: string[];
  features: string[];
  limitsThatStopWork: string[];
  limitsThatCharge: string[];
}

export interface Subscription {
  workspaceId: string;
  planId: PlanId;
  interval: BillingInterval;
  status: 'active' | 'pending' | 'past_due' | 'cancelled';
  renewsAt: number;
  creditsIncluded: number;
  creditsUsed: number;
  seatsUsed: number;
}

export type CheckoutStatus =
  | 'open'
  | 'pending_confirmation'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface CheckoutSession {
  id: string;
  workspaceId: string;
  planId: PlanId;
  interval: BillingInterval;
  amountUsd: number;
  status: CheckoutStatus;
  createdAt: number;
  returnTo: string;
  /** Number of completion callbacks received; must not multiply purchases. */
  callbacks: number;
  operationId: string;
  failureReason?: string;
  /** Set once the subscription was granted for this checkout (idempotency marker). */
  fulfilledAt?: number;
}

export interface UsageRecord {
  id: string;
  workspaceId: string;
  at: number;
  kind: 'run' | 'export';
  refId: string;
  credits: number;
  operationId: string;
}

export interface Invoice {
  id: string;
  at: number;
  amountUsd: number;
  status: 'paid' | 'pending' | 'void';
  description: string;
}

export function yearlyMonthlyEquivalent(plan: Plan): number {
  return Math.round((plan.yearlyUsd / 12) * 100) / 100;
}
