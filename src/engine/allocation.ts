/**
 * Allocation of a month's contribution across the CPF accounts.
 *
 * CPF Board states the order and the engine reproduces it: MediSave is
 * computed first, then Special (or Retirement from 55), and the Ordinary
 * Account takes the remainder. The published Ordinary ratio is never
 * multiplied by. Taking it as the remainder is what guarantees the three
 * shares add up to the contribution exactly, with no cent created or lost.
 *
 * Rounding is provisional. CPF Board publishes the ratios to four places but
 * neither a rule nor a worked example for a share that falls between cents,
 * and a whole-dollar contribution times a four-place ratio usually does. The
 * engine rounds each computed share to the nearest cent, half a cent rounding
 * up, and leaves the remainder to Ordinary. Replace this if CPF Board states
 * its rule; see the TODO in `__fixtures__/index.ts`.
 *
 * From 55 the Special Account is closed, so its share goes to the Retirement
 * Account, but only up to the Full Retirement Sum. Whatever the Retirement
 * Account has no room for goes to the Ordinary Account instead.
 */

import { bandForAge } from '@/rules';
import type { AllocationBand, RuleSet } from '@/rules';
import { bandAge, onFrom55Rules } from './contributions';
import type { AccountAmounts, Cents } from './types';

const BASIS_POINTS = 10_000;

/** The allocation band in force for a member of this age, from the rule set. */
export function allocationBandForMonth(rules: RuleSet, ageInMonths: number): AllocationBand {
  // The same age as the contribution band: a new band applies from the month
  // after the birthday month, so rates and ratios always change together.
  const age = bandAge(ageInMonths);
  const band = bandForAge(rules.allocation.bands, age);
  if (!band) {
    // Only reachable if a rule set has no open-ended final band, which the
    // rule-set tests forbid.
    throw new RangeError(`No allocation band for age ${age} in ${rules.id}`);
  }
  return band;
}

/** A ratio's share of an amount, to the nearest cent with half a cent rounding up. */
function share(amount: Cents, ratio: number): Cents {
  const basisPoints = Math.round(ratio * BASIS_POINTS);
  return Math.floor((amount * basisPoints + BASIS_POINTS / 2) / BASIS_POINTS);
}

/** The three published shares, in CPF Board's order, before any routing. */
export interface AllocationShares {
  medisave: Cents;
  specialOrRetirement: Cents;
  ordinary: Cents;
}

/**
 * Splits a contribution by a band's ratios: MediSave, then Special or
 * Retirement, then the remainder to Ordinary.
 *
 * Exported on its own because CPF Board's worked examples show this step and
 * nothing else, so the fixtures exercise it directly.
 */
export function splitContribution(total: Cents, band: AllocationBand): AllocationShares {
  const medisave = share(total, band.medisave);
  const specialOrRetirement = share(total, band.specialOrRetirement);
  return { medisave, specialOrRetirement, ordinary: total - medisave - specialOrRetirement };
}

export interface AllocationRequest {
  rules: RuleSet;
  ageInMonths: number;
  /** The month's total contribution, employee and employer together. */
  total: Cents;
  /** The Retirement Account balance before this month's contribution lands. */
  retirementBalance: Cents;
  /** The Full Retirement Sum fixed for this member's cohort, in cents. */
  fullRetirementSum: Cents;
}

/**
 * Where a month's contribution lands, account by account.
 *
 * Below 55 the second share goes to the Special Account. From the month after
 * the 55th birthday it goes to the Retirement Account up to the Full
 * Retirement Sum, and the excess to Ordinary. The switch is on the same
 * boundary as the contribution and allocation bands, so in the birthday month
 * the member is still on the 55-and-below band and the share still goes to
 * the Special Account.
 *
 * MediSave is credited in full here. Capping it at the Basic Healthcare Sum
 * and routing the overflow is a separate step, applied after this one.
 */
export function allocateContribution({
  rules,
  ageInMonths,
  total,
  retirementBalance,
  fullRetirementSum,
}: AllocationRequest): AccountAmounts {
  const shares = splitContribution(total, allocationBandForMonth(rules, ageInMonths));

  if (!onFrom55Rules(ageInMonths)) {
    return {
      ordinary: shares.ordinary,
      special: shares.specialOrRetirement,
      medisave: shares.medisave,
      retirement: 0,
    };
  }

  const room = Math.max(0, fullRetirementSum - retirementBalance);
  const retirement = Math.min(shares.specialOrRetirement, room);
  return {
    ordinary: shares.ordinary + (shares.specialOrRetirement - retirement),
    special: 0,
    medisave: shares.medisave,
    retirement,
  };
}
