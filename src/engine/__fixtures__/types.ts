/**
 * Worked-example fixture types.
 *
 * A fixture is a figure CPF Board itself published, transcribed as it appears
 * on the page. None is computed by this project: if the engine disagrees with
 * a fixture, the engine is wrong. Money is in cents, as in the engine, so a
 * published "$13,795.58" is `1_379_558`.
 */

import type { SourceId } from '@/rules';
import type { AccountName } from '../types';

/** Where on a source a fixture was read, precise enough to find it again. */
export interface FixtureCitation {
  sourceId: SourceId;
  /** Example number, table and page as printed on the source. */
  locator: string;
}

/**
 * The rules a worked example was computed under, as its source states them.
 *
 * Some examples predate the current rule set, so a fixture carries its own
 * parameters rather than assuming today's. The engine test builds a rule set
 * from these, which keeps a 2024 example valid after the rates move on.
 */
export interface ContributionAssumptions {
  /** Where the rates and ceiling below are stated, if not on the example's own page. */
  cite: FixtureCitation;
  ordinaryWageCeiling: number;
  /** Inclusive upper bound of the age band applied, matching `ContributionBand`. */
  throughAge: number | null;
  /** Total contribution as a fraction of wages. */
  total: number;
  /** Employee share as a fraction of wages. */
  employee: number;
}

export interface ContributionFixture {
  id: string;
  description: string;
  cite: FixtureCitation;
  assumes: ContributionAssumptions;
  /**
   * Which wage component the example tabulates. CPF Board's examples show
   * contributions on Ordinary and Additional Wages in separate columns, and
   * each is rounded on its own there.
   */
  component: 'ordinary' | 'additional';
  /** Wage paid for the month, before any ceiling. Omitted where the source gives only the capped figure. */
  wagePaid?: number;
  /** Wage subject to CPF after the ceiling. */
  wageSubjectToCpf: number;
  expected: {
    total: number;
    employee: number;
    employer: number;
  };
}

/* Derived fixtures --------------------------------------------------------
 *
 * CPF Board publishes the rules for interest and for accrued housing interest
 * but no worked example of either, so these fixtures are computed here from
 * the rule text rather than transcribed. They are a weaker kind of evidence:
 * they hold the engine to this project's reading of a rule, not to CPF Board's
 * own arithmetic. Every one is marked `derived` so the difference stays
 * visible, quotes the rules it was computed from, and states its assumptions.
 *
 * Balances are chosen so every figure lands exactly on a cent. CPF Board does
 * not publish how it rounds within a month, and a fixture must not invent one.
 */

export interface RuleQuote {
  cite: FixtureCitation;
  /** The sentence the derivation rests on, copied from the page. */
  quote: string;
}

export interface Derived {
  derived: true;
  id: string;
  description: string;
  rules: RuleQuote[];
  /** Anything the rules do not settle, which the figures below assume. */
  assumptions: string[];
  /** The arithmetic in full, so a reviewer can check it without running it. */
  workings: string[];
}

/**
 * Balances per account, in cents. Absent accounts are zero, which keeps a
 * fixture to the accounts its example actually mentions.
 */
export type AccountAmounts = Partial<Record<AccountName, number>>;

export type { AccountName };

export interface BaseInterestFixture extends Derived {
  age: number;
  openingBalances: AccountAmounts;
  /** Contributions received during the year, by calendar month (1 = January). */
  contributions?: readonly { month: number; account: AccountName; amount: number }[];
  /** Base interest credited for the year, per account. */
  expected: AccountAmounts;
}

export interface ExtraInterestFixture extends Derived {
  age: number;
  balances: AccountAmounts;
  /** How much of each account counts towards the tiers, in the published order. */
  expectedCounted: AccountAmounts;
  /** Extra interest earned on each account's balance, before routing. */
  expectedEarnedOn: AccountAmounts;
  /** Where that extra interest is credited. Interest earned on OA is not credited to OA. */
  expectedCreditedTo: AccountAmounts;
}

export interface HousingAccruedInterestFixture extends Derived {
  /** CPF principal withdrawn, by year of the projection (1 = first year). */
  withdrawals: readonly { year: number; amount: number }[];
  /** Whole years over which interest accrues. */
  years: number;
  expected: {
    principal: number;
    accruedInterest: number;
    /** Principal plus accrued interest: what must be refunded on sale. */
    refundable: number;
  };
}

export interface AllocationFixture {
  id: string;
  description: string;
  cite: FixtureCitation;
  /** Member's age in years, as stated in the example. */
  age: number;
  contribution: number;
  /** Ratios the example multiplies by, as printed. */
  ratios: {
    specialOrRetirement: number;
    medisave: number;
  };
  expected: {
    ordinary: number;
    /** Special Account below 55; Retirement Account from 55. */
    specialOrRetirement: number;
    medisave: number;
  };
}
