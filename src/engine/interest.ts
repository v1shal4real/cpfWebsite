/**
 * Base interest on each CPF account.
 *
 * The convention, as CPF Board states it on "How is my CPF interest computed
 * and credited into my accounts?" (source `interestComputation`, read on
 * 30 September 2026):
 *
 *   - "CPF interest is computed monthly. It is credited to your respective
 *     accounts by the following year and compounded annually."
 *   - "Contributions (including refunds) received this month start earning
 *     interest next month."
 *   - "Withdrawals/deductions in this month will not earn interest from this
 *     month onwards."
 *
 * What the engine does with that:
 *
 *   1. Each month, every account earns a twelfth of its annual rate on its
 *      earning balance: the balance at the start of the month, less anything
 *      withdrawn during it. Money received during the month is not in the
 *      opening balance, so it starts earning the month after, as stated.
 *   2. The month's interest is held aside, not added to the balance. Because
 *      balances move only when interest is credited, interest does not earn
 *      interest within the year: it compounds annually.
 *   3. The year's interest is credited at the end of December, so the balance
 *      carried into January includes it. "By the following year" is read as
 *      that year-end crediting.
 *
 * Rates come from the rule set resolved for the month, so a rate change
 * applies from the month it takes effect, including partway through a year.
 *
 * Rounding is provisional. CPF Board publishes no rule for how a month's
 * interest is rounded. The engine keeps the year's interest exactly, as whole
 * units of 1/120,000 of a cent (cents x basis points / 12 months), and rounds
 * once, to the nearest cent with half a cent rounding up, when it is credited.
 * Rounding each month instead could make the annual figure drift by a few
 * cents. The derived fixtures use balances that make every monthly figure a
 * whole cent, so they hold under either reading. Replace this if CPF Board
 * states its rule.
 */

import type { RuleSet } from '@/rules';
import type { AccountAmounts, AccountName, Cents } from './types';

const BASIS_POINTS = 10_000;
const MONTHS_PER_YEAR = 12;

/** One cent, in the exact units interest is accrued in. */
const CENT = BASIS_POINTS * MONTHS_PER_YEAR;

/** The month whose step credits the year's interest. */
export const CREDITING_MONTH = 12;

const ACCOUNTS: readonly AccountName[] = ['ordinary', 'special', 'medisave', 'retirement'];

/**
 * Interest earned so far this calendar year and not yet credited, per account,
 * in exact units of 1/120,000 of a cent. Never shown to anyone: convert with
 * `creditInterest`.
 */
export type AccruedThisYear = Record<AccountName, number>;

export const NOTHING_ACCRUED: AccruedThisYear = {
  ordinary: 0,
  special: 0,
  medisave: 0,
  retirement: 0,
};

/** The annual base rate for an account, from the rule set, in basis points. */
function rateInBasisPoints(rules: RuleSet, account: AccountName): number {
  return Math.round(rules.interest[account] * BASIS_POINTS);
}

/** Exact accrual units to cents, half a cent rounding up. */
function toCents(units: number): Cents {
  return Math.floor((units + CENT / 2) / CENT);
}

/**
 * The balances that earn interest this month: the opening balance less
 * anything withdrawn during the month, never below zero.
 */
export function earningBalances(
  opening: AccountAmounts,
  withdrawn: Partial<AccountAmounts> = {},
): AccountAmounts {
  const earning = { ...opening };
  for (const account of ACCOUNTS) {
    earning[account] = Math.max(0, opening[account] - (withdrawn[account] ?? 0));
  }
  return earning;
}

export interface BaseInterestRequest {
  rules: RuleSet;
  /** From `earningBalances`. */
  earning: AccountAmounts;
  accruedThisYear: AccruedThisYear;
}

export interface BaseInterestMonth {
  /**
   * Interest earned this month, per account, in cents. Reported as the change
   * in the rounded year-to-date figure, so the months of a year always add up
   * to exactly what is credited.
   */
  baseAccrued: AccountAmounts;
  accruedThisYear: AccruedThisYear;
}

/** One month of base interest, accrued but not credited. */
export function accrueBaseInterest({
  rules,
  earning,
  accruedThisYear,
}: BaseInterestRequest): BaseInterestMonth {
  const next = { ...accruedThisYear };
  const baseAccrued = { ...NOTHING_ACCRUED };
  for (const account of ACCOUNTS) {
    next[account] += earning[account] * rateInBasisPoints(rules, account);
    baseAccrued[account] = toCents(next[account]) - toCents(accruedThisYear[account]);
  }
  return { baseAccrued, accruedThisYear: next };
}

/** The interest credited for the year so far, rounded to the cent. */
export function creditInterest(accruedThisYear: AccruedThisYear): AccountAmounts {
  const credited = { ...NOTHING_ACCRUED };
  for (const account of ACCOUNTS) credited[account] = toCents(accruedThisYear[account]);
  return credited;
}
