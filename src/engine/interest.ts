/**
 * Base and extra interest on each CPF account.
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
 * Extra interest follows CPF Board's "How much extra interest can I earn on my
 * CPF savings?" (source `extraInterest`, read on 30 September 2026):
 *
 *   - Below 55: "an extra interest of 1% per annum on the first $60,000 of
 *     your combined CPF balances (capped at $20,000 for OA)".
 *   - From 55: "2% per annum on the first $30,000 and 1% per annum on the next
 *     $30,000 of your combined CPF balances (capped at $20,000 for OA)".
 *   - Accounts are counted towards the combined balance in the order RA, then
 *     OA up to $20,000, then SA, then MA.
 *   - Extra interest on SA, MA and RA stays in those accounts; extra interest
 *     on OA goes to SA below 55 and to RA from 55.
 *
 * The engine fills the tiers in that counting order, each account taking what
 * room is left, so from 55 an account can straddle two tiers. Each account
 * then earns extra interest on the part of itself that was counted. The tiers,
 * the order, the OA cap and the routing are all read from the rule set.
 *
 * Extra interest is computed monthly on the same earning balances as base
 * interest, and held and credited with it in December. The extra-interest page
 * does not state that timing; it is read from the general statement above that
 * CPF interest is computed monthly and credited annually.
 *
 * The OA cap is why drawing the Ordinary Account below $20,000 costs more than
 * its own 2.5%: every dollar under the cap that leaves OA also leaves the
 * extra-interest tier, and the room it frees is refilled only if SA or MA holds
 * savings the tier was not already counting.
 *
 * The switch to the from-55 tiers and routing happens on the same boundary as
 * the contribution and allocation bands: from the month after the 55th
 * birthday month. The age-55 transition ticket owns that boundary.
 *
 * Rounding is provisional. CPF Board publishes no rule for how a month's
 * interest is rounded. The engine keeps the year's interest exactly, as whole
 * units of 1/120,000 of a cent (cents x basis points / 12 months), and rounds
 * once, to the nearest cent with half a cent rounding up, when it is credited.
 * Base and extra interest are held and rounded separately, so an account is
 * credited its rounded base interest plus the rounded extra interest routed to
 * it. Rounding each month instead could make the annual figure drift by a few
 * cents. The derived fixtures use balances that make every monthly figure a
 * whole cent, so they hold under either reading. Replace this if CPF Board
 * states its rule.
 */

import type { ExtraInterestTier, RuleSet } from '@/rules';
import { onFrom55Rules } from './contributions';
import type { AccountAmounts, AccountName, Cents } from './types';

const BASIS_POINTS = 10_000;
const MONTHS_PER_YEAR = 12;
const CENTS_PER_DOLLAR = 100;

/** One cent, in the exact units interest is accrued in. */
const CENT = BASIS_POINTS * MONTHS_PER_YEAR;

/** The month whose step credits the year's interest. */
export const CREDITING_MONTH = 12;

const ACCOUNTS: readonly AccountName[] = ['ordinary', 'special', 'medisave', 'retirement'];

/** Per account, in exact units of 1/120,000 of a cent. */
export type InterestUnits = Record<AccountName, number>;

const NO_UNITS: InterestUnits = { ordinary: 0, special: 0, medisave: 0, retirement: 0 };

/**
 * Interest earned so far this calendar year and not yet credited, in exact
 * units of 1/120,000 of a cent. Never shown to anyone: convert with
 * `creditInterest`.
 */
export interface AccruedThisYear {
  /** Base interest, by account. */
  base: InterestUnits;
  /** Extra interest, by the account whose balance earned it. */
  extraOn: InterestUnits;
  /** Extra interest, by the account it will be credited to. */
  extraTo: InterestUnits;
}

export const NOTHING_ACCRUED: AccruedThisYear = {
  base: NO_UNITS,
  extraOn: NO_UNITS,
  extraTo: NO_UNITS,
};

/** A rate as whole basis points, so the arithmetic stays exact. */
function basisPoints(rate: number): number {
  return Math.round(rate * BASIS_POINTS);
}

/** Exact accrual units to cents, half a cent rounding up. */
function toCents(units: number): Cents {
  return Math.floor((units + CENT / 2) / CENT);
}

function zeroAmounts(): AccountAmounts {
  return { ordinary: 0, special: 0, medisave: 0, retirement: 0 };
}

/**
 * What a month reports: the change in the rounded year-to-date figure, per
 * account, so that the months of a year add up to what is credited.
 */
function reported(before: InterestUnits, after: InterestUnits): AccountAmounts {
  const amounts = zeroAmounts();
  for (const account of ACCOUNTS) amounts[account] = toCents(after[account]) - toCents(before[account]);
  return amounts;
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

/** The extra-interest tiers in force for a member of this age, from the rule set. */
export function extraInterestTiers(rules: RuleSet, ageInMonths: number): readonly ExtraInterestTier[] {
  return onFrom55Rules(ageInMonths) ? rules.interest.extraTiersFrom55 : rules.interest.extraTiersBelow55;
}

/** The account that extra interest earned on an account's balance is credited to. */
export function extraInterestDestination(
  rules: RuleSet,
  ageInMonths: number,
  earnedOn: AccountName,
): AccountName {
  if (earnedOn !== 'ordinary') return earnedOn;
  switch (rules.interest.extraInterestOnOrdinaryCreditedTo) {
    case 'special-or-retirement':
      return onFrom55Rules(ageInMonths) ? 'retirement' : 'special';
  }
}

export interface ExtraInterestCount {
  /** How much of each account's balance counts towards the tiers, in cents. */
  counted: AccountAmounts;
  /**
   * The extra interest each counted balance earns in one month, by the
   * account whose balance earned it, in exact units of 1/120,000 of a cent.
   */
  monthlyUnits: InterestUnits;
}

/**
 * Fills the extra-interest tiers from a set of balances.
 *
 * Accounts are taken in the rule set's counting order. Each takes as much of
 * the remaining tiers as its balance allows, the Ordinary Account no more than
 * its cap, and earns each tier's rate on the part of itself that tier holds.
 * Tiers fill in the order listed, so from 55 the accounts counted first are
 * the ones that earn the higher rate.
 */
export function countForExtraInterest(
  rules: RuleSet,
  ageInMonths: number,
  balances: AccountAmounts,
): ExtraInterestCount {
  const { extraInterestCountingOrder, ordinaryAccountExtraInterestCap } = rules.interest;
  const tiers = extraInterestTiers(rules, ageInMonths).map((tier) => ({
    room: tier.amount * CENTS_PER_DOLLAR,
    rate: basisPoints(tier.rate),
  }));
  const counted = zeroAmounts();
  const monthlyUnits = { ...NO_UNITS };

  for (const account of extraInterestCountingOrder) {
    let eligible =
      account === 'ordinary'
        ? Math.min(balances.ordinary, ordinaryAccountExtraInterestCap * CENTS_PER_DOLLAR)
        : balances[account];
    for (const tier of tiers) {
      if (eligible <= 0) break;
      const taken = Math.min(eligible, tier.room);
      tier.room -= taken;
      eligible -= taken;
      counted[account] += taken;
      monthlyUnits[account] += taken * tier.rate;
    }
  }

  return { counted, monthlyUnits };
}

export interface InterestRequest {
  rules: RuleSet;
  ageInMonths: number;
  /** From `earningBalances`. */
  earning: AccountAmounts;
  accruedThisYear: AccruedThisYear;
}

export interface InterestMonth {
  /**
   * Base interest earned this month, per account, in cents. Like the two
   * extra-interest figures, it is reported as the change in the rounded
   * year-to-date figure, so the months of a year add up to exactly what is
   * credited.
   */
  baseAccrued: AccountAmounts;
  /** Extra interest earned this month, by the account whose balance earned it. */
  extraAccruedOn: AccountAmounts;
  /** Extra interest earned this month, by the account it will be credited to. */
  extraAccruedTo: AccountAmounts;
  accruedThisYear: AccruedThisYear;
}

/** One month of base and extra interest, accrued but not credited. */
export function accrueInterest({
  rules,
  ageInMonths,
  earning,
  accruedThisYear,
}: InterestRequest): InterestMonth {
  const base = { ...accruedThisYear.base };
  const extraOn = { ...accruedThisYear.extraOn };
  const extraTo = { ...accruedThisYear.extraTo };

  for (const account of ACCOUNTS) {
    base[account] += earning[account] * basisPoints(rules.interest[account]);
  }

  const { monthlyUnits } = countForExtraInterest(rules, ageInMonths, earning);
  for (const account of ACCOUNTS) {
    extraOn[account] += monthlyUnits[account];
    extraTo[extraInterestDestination(rules, ageInMonths, account)] += monthlyUnits[account];
  }

  return {
    baseAccrued: reported(accruedThisYear.base, base),
    extraAccruedOn: reported(accruedThisYear.extraOn, extraOn),
    extraAccruedTo: reported(accruedThisYear.extraTo, extraTo),
    accruedThisYear: { base, extraOn, extraTo },
  };
}

/**
 * The interest credited for the year so far: each account's rounded base
 * interest plus the rounded extra interest routed to it.
 */
export function creditInterest(accruedThisYear: AccruedThisYear): AccountAmounts {
  const credited = zeroAmounts();
  for (const account of ACCOUNTS) {
    credited[account] =
      toCents(accruedThisYear.base[account]) + toCents(accruedThisYear.extraTo[account]);
  }
  return credited;
}
