/**
 * The Basic Healthcare Sum cap on MediSave, and where the overflow goes.
 *
 * CPF Board, "What is the Basic Healthcare Sum?" (source `basicHealthcareSum`,
 * read on 8 October 2026): the BHS "is the maximum amount you can hold in
 * your MA". It is adjusted annually for members below 65, and "once CPF
 * members reach age 65, their BHS is fixed and will remain unchanged for the
 * rest of their lives". `basicHealthcareSumForMember` in `src/rules` resolves
 * which figure applies, from the escalation series.
 *
 * CPF Board, "After I have met the Basic Healthcare Sum, why do the excess
 * MediSave Account savings overflow to my Special Account or Retirement
 * Account instead of my Ordinary Account?" (source `medisaveOverflow`, read on
 * 8 October 2026): excess MediSave contributions are "first transferred to
 * your Special Account (SA) or Retirement Account (RA) to help you set aside
 * your Full Retirement Sum (FRS)", and once the FRS is set aside, to the
 * Ordinary Account.
 *
 * What the engine does with that:
 *
 *   1. The cap is applied once a month, after the month's contribution and
 *      any December interest credit have landed. Whatever took MediSave over
 *      the BHS, a contribution or interest, is moved on, so MediSave never
 *      closes a month above the cap. CPF Board's pages speak of contributions;
 *      treating credited interest the same way follows from the BHS being "the
 *      maximum amount you can hold in your MA".
 *   2. Below 55 the overflow goes to the Special Account until it holds the
 *      FRS, then to the Ordinary Account. There is no cohort FRS before 55,
 *      so the FRS in force in the current year is used: the sum for the
 *      cohort turning 55 that year.
 *   3. From 55 it goes to the Retirement Account until it holds the member's
 *      own cohort FRS, then to the Ordinary Account.
 *
 * The 55 boundary is the one every age rule uses: from the month after the
 * 55th birthday month. Amounts are whole cents, so nothing is rounded here.
 */

import type { RuleSet } from '@/rules';
import { onFrom55Rules } from './contributions';
import type { AccountAmounts, Cents, MedisaveOverflow } from './types';

export interface MedisaveCapRequest {
  rules: RuleSet;
  ageInMonths: number;
  /** Balances after the month's contribution and interest, before the cap. */
  balances: AccountAmounts;
  /** The cap for this member this month, in cents. */
  basicHealthcareSum: Cents;
  /**
   * The Full Retirement Sum the overflow fills towards, in cents: the one in
   * force this year below 55, the member's cohort sum from 55.
   */
  fullRetirementSum: Cents;
}

export interface MedisaveCapResult {
  balances: AccountAmounts;
  overflow: MedisaveOverflow;
}

/** Holds MediSave to the Basic Healthcare Sum and routes the excess. */
export function capMedisave({
  rules,
  ageInMonths,
  balances,
  basicHealthcareSum,
  fullRetirementSum,
}: MedisaveCapRequest): MedisaveCapResult {
  const to: AccountAmounts = { ordinary: 0, special: 0, medisave: 0, retirement: 0 };
  const amount = Math.max(0, balances.medisave - basicHealthcareSum);
  if (amount === 0) {
    return { balances: { ...balances }, overflow: { basicHealthcareSum, amount, to } };
  }

  switch (rules.thresholds.medisaveOverflowTo) {
    case 'special-or-retirement-until-full-retirement-sum-then-ordinary': {
      const retirementSavings = onFrom55Rules(ageInMonths) ? 'retirement' : 'special';
      const room = Math.max(0, fullRetirementSum - balances[retirementSavings]);
      to[retirementSavings] = Math.min(amount, room);
      to.ordinary = amount - to[retirementSavings];
      break;
    }
  }

  return {
    balances: {
      ordinary: balances.ordinary + to.ordinary,
      special: balances.special + to.special,
      medisave: balances.medisave - amount,
      retirement: balances.retirement + to.retirement,
    },
    overflow: { basicHealthcareSum, amount, to },
  };
}
