/**
 * CPF LIFE monthly payout estimates, from the Retirement Account at 65.
 *
 * CPF Board does not publish its annuity formula. It publishes a table of
 * Standard Plan payouts against the RA savings at 65 (source
 * `cpfLifePayouts`), and the engine reads the estimate off that table:
 * straight-line between the published rows, and in proportion to the nearest
 * row outside them. Across the table the payout is close to proportional to
 * the premium, about $5.40 a month for every $1,000, so neither choice is a
 * stretch.
 *
 * The Escalating Plan starts lower and rises: "about 20% lower than the
 * Standard Plan but increases by about 2% p.a." (`cpfLifePlansComparison`),
 * with the 2% stated on the plan's own page (`cpfLifeEscalatingPlan`).
 *
 * The Basic Plan is not estimated. CPF Board publishes its mechanics (only
 * 10-20% of the RA becomes the premium; payouts fall once balances drop below
 * $60,000) but no figures that scale to a member's balance.
 *
 * What this is, and is not. The table is for a male member turning 55 in
 * 2026. Applied to a member who reaches 65 decades from now, it assumes the
 * payout per dollar of premium stays as it is today; CPF Board says payouts
 * "may also be adjusted to account for long-term changes in interest rates or
 * life expectancy". The payout is in that year's dollars, like every other
 * figure in the projection. These are estimates, never quotes.
 */

import type { CpfLifePayoutPoint, CpfLifeRules } from '@/rules';
import type { Cents } from './types';

const CENTS_PER_DOLLAR = 100;

export interface CpfLifeEstimate {
  /** The premium: Retirement Account savings at 65. */
  premiumAt65: Cents;
  /** Standard Plan, level for life. Monthly, in whole dollars as cents. */
  standardFrom65: Cents;
  /** Standard Plan, deferred to start at 70. */
  standardFrom70: Cents;
  /** Escalating Plan's first payout at 65. */
  escalatingFrom65: Cents;
  /** Escalating Plan's yearly rise, as a fraction. */
  escalatingAnnualRise: number;
}

type Column = 'monthlyFrom65' | 'monthlyFrom70';

/** A payout for a premium, in dollars, read off the published table. */
export function payoutFromTable(
  table: readonly CpfLifePayoutPoint[],
  premium: number,
  column: Column,
): number {
  const first = table[0];
  const last = table.at(-1);
  if (!first || !last || premium <= 0) return 0;
  if (premium <= first.premiumAt65) return (first[column] / first.premiumAt65) * premium;
  if (premium >= last.premiumAt65) return (last[column] / last.premiumAt65) * premium;
  for (let index = 1; index < table.length; index++) {
    const upper = table[index]!;
    if (premium > upper.premiumAt65) continue;
    const lower = table[index - 1]!;
    const share = (premium - lower.premiumAt65) / (upper.premiumAt65 - lower.premiumAt65);
    return lower[column] + share * (upper[column] - lower[column]);
  }
  return (last[column] / last.premiumAt65) * premium;
}

/** Whole dollars, as cents: CPF Board quotes payouts to the dollar. */
const toWholeDollarCents = (dollars: number): Cents => Math.round(dollars) * CENTS_PER_DOLLAR;

export function estimateCpfLife(rules: CpfLifeRules, premiumAt65: Cents): CpfLifeEstimate {
  const premium = premiumAt65 / CENTS_PER_DOLLAR;
  const from65 = payoutFromTable(rules.standardTable, premium, 'monthlyFrom65');
  return {
    premiumAt65,
    standardFrom65: toWholeDollarCents(from65),
    standardFrom70: toWholeDollarCents(payoutFromTable(rules.standardTable, premium, 'monthlyFrom70')),
    escalatingFrom65: toWholeDollarCents(from65 * rules.escalatingStartRatio),
    escalatingAnnualRise: rules.escalatingAnnualRise,
  };
}

/** The Escalating Plan's payout at an age from 65: the first payout risen once a year. */
export function escalatingPayoutAt(estimate: CpfLifeEstimate, age: number): Cents {
  const years = Math.max(0, Math.floor(age) - 65);
  return toWholeDollarCents(
    (estimate.escalatingFrom65 / CENTS_PER_DOLLAR) * (1 + estimate.escalatingAnnualRise) ** years,
  );
}
