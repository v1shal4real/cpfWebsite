/**
 * Accrued interest on CPF savings used for housing.
 *
 * CPF Board, "Why do I need to refund the accrued interest on the amount of
 * CPF savings used for my property?" (source `housingAccruedInterest`, read on
 * 11 October 2026): accrued interest is the interest the savings would have
 * earned had they stayed in the account, "based on CPF's prevailing interest
 * rates and compounded annually", and it "runs from the date you first used
 * your CPF savings for the property until the date the CPF refund is made". It
 * "continues to accrue even after your housing loan has been fully repaid".
 * On sale, the principal and the accrued interest are refunded to CPF.
 *
 * What the engine does with that. The principal used is treated as if it were
 * still sitting in the Ordinary Account, earning exactly what that account
 * would have:
 *
 *   1. Each month, a twelfth of the rule set's `housing.accruedInterestRate`
 *      is computed on the cumulative principal plus the interest credited in
 *      earlier years.
 *   2. A withdrawal accrues from the month it is made. That is the month it
 *      stops earning in the Ordinary Account, so no month is lost between the
 *      two and none is counted twice.
 *   3. The year's interest is credited at the end of December, so it compounds
 *      annually, on the cumulative principal.
 *
 * Unlike the OA's own interest, the refundable figure counts the year so far
 * as well as the years credited: a sale partway through a year refunds the
 * interest up to that month. So each month reports the accrued interest to
 * date, and the refund due if the property were sold then.
 *
 * Rates come from the rule set in force each month, so a rate change applies
 * from the month it takes effect. Rounding mirrors base interest and is just
 * as provisional: the year is kept exact, in whole units of 1/120,000 of a
 * cent, and rounded to the nearest cent, half up, when it is credited.
 *
 * No CPF Board worked example exists; the derived fixtures in
 * `__fixtures__/housing.ts` are computed from the rule text above.
 */

import type { RuleSet } from '@/rules';
import type { Cents } from './types';

const BASIS_POINTS = 10_000;
const MONTHS_PER_YEAR = 12;

/** One cent, in the exact units the year's interest is kept in. */
const CENT = BASIS_POINTS * MONTHS_PER_YEAR;

/** The month whose step credits the year's accrued interest, as for CPF interest. */
export const ACCRUED_INTEREST_CREDITING_MONTH = 12;

/** Exact units to cents, half a cent up. */
function toCents(units: number): Cents {
  return Math.floor((units + CENT / 2) / CENT);
}

export interface AccruedInterestState {
  /** CPF principal used for housing so far. */
  principalUsed: Cents;
  /** Accrued interest credited in earlier years, which now compounds. */
  credited: Cents;
  /** This year's accrued interest so far, not yet credited, in exact units. */
  accruingThisYear: number;
}

export const NO_HOUSING_USE: AccruedInterestState = {
  principalUsed: 0,
  credited: 0,
  accruingThisYear: 0,
};

export interface AccruedInterestMonth {
  state: AccruedInterestState;
  principalUsed: Cents;
  /** Accrued interest to date: the years credited plus this year so far. */
  accruedInterest: Cents;
  /** Principal plus accrued interest: the refund due on a sale this month. */
  refundable: Cents;
}

export interface AccruedInterestRequest {
  rules: RuleSet;
  state: AccruedInterestState;
  /** CPF withdrawn for the property this month. */
  withdrawn: Cents;
  /** The calendar month, 1 to 12. December credits the year. */
  calendarMonth: number;
}

/** One month of accrued interest on CPF used for housing. */
export function accrueHousingInterest({
  rules,
  state,
  withdrawn,
  calendarMonth,
}: AccruedInterestRequest): AccruedInterestMonth {
  const principalUsed = state.principalUsed + withdrawn;
  const rate = Math.round(rules.housing.accruedInterestRate * BASIS_POINTS);

  // Annual compounding: this year's own interest is not yet part of the base.
  let accruingThisYear = state.accruingThisYear + (principalUsed + state.credited) * rate;
  let credited = state.credited;
  if (calendarMonth === ACCRUED_INTEREST_CREDITING_MONTH) {
    credited += toCents(accruingThisYear);
    accruingThisYear = 0;
  }

  const accruedInterest = credited + toCents(accruingThisYear);
  return {
    state: { principalUsed, credited, accruingThisYear },
    principalUsed,
    accruedInterest,
    refundable: principalUsed + accruedInterest,
  };
}
