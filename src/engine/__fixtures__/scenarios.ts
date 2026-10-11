/**
 * Representative scenarios for the performance budget.
 *
 * Spec §3.4: a full recomputation must finish under 50ms so scrubbing feels
 * continuous. "Full recomputation" is what the interface does on each change:
 * validate and project both scenarios of a comparison. These two are the
 * heaviest realistic pair: a 22-year-old projected to 65 (517 months each),
 * buying a flat at 30, one on an HDB loan with instalments from the OA and
 * one on a bank loan paid in cash, so every part of the engine runs, the
 * age-55 transition included.
 */

import type { ProjectionDraft } from '../validate';

const BASE: ProjectionDraft = {
  startMonth: '2026-01',
  currentAge: 22,
  monthlySalary: 450_000,
  salaryGrowthRate: 300 / 10_000,
  balances: { ordinary: 500_000, special: 200_000, medisave: 300_000 },
  housingPlan: 'hdb-loan',
  propertyPrice: 50_000_000,
  purchaseAge: 30,
  downpayment: 10_000_000,
  downpaymentShareFromOrdinaryAccount: 7_500 / 10_000,
  loanTenureYears: 25,
  ordinaryAccountRetention: 2_000_000,
  instalmentsPaidFrom: 'ordinary-account',
};

export const SCENARIO_A: ProjectionDraft = BASE;

export const SCENARIO_B: ProjectionDraft = {
  ...BASE,
  housingPlan: 'bank-loan',
  loanTenureYears: 30,
  bankLoanRate: 300 / 10_000,
  instalmentsPaidFrom: 'cash',
};

/** The performance budget for one full recomputation of both scenarios, in milliseconds. */
export const RECOMPUTE_BUDGET_MS = 50;
