/**
 * The age-55 transition.
 *
 * Six rule changes happen at 55, and the engine applies them as one discrete
 * step in a fixed order rather than letting them drift in month by month:
 *
 *   1. The Retirement Account is created.
 *   2. Special Account savings move into it, up to the cohort Full Retirement
 *      Sum.
 *   3. Ordinary Account savings top it up, if the SA was not enough, keeping
 *      back the $5,000 a member short of the FRS may withdraw.
 *   4. The Special Account closes. Whatever the RA had no room for goes to the
 *      Ordinary Account.
 *   5. What the member may now withdraw is worked out and reported. It is
 *      never withdrawn: whether to take it is the member's decision.
 *   6. Contribution rates, allocation ratios and the extra-interest tiers
 *      switch to their from-55 values, from the following month.
 *
 * Sources, all CPF Board, read on 8 October 2026:
 *
 *   - "Why are Special Account savings transferred first to Retirement Account
 *     at 55?" (`retirementAccountFormation`): "SA savings are first
 *     transferred to your Retirement Account (RA) to help you set aside the
 *     retirement sum", followed by OA savings.
 *   - "Closure of Special Account for members aged 55 and above"
 *     (`specialAccountClosure`): "The savings in the SA will be transferred to
 *     the Retirement Account (RA), up to the Full Retirement Sum (FRS)... Any
 *     remaining SA savings will be transferred to the Ordinary Account (OA)",
 *     and a member's SA "will only be closed when they turn age 55 and their
 *     RA is created".
 *   - "How much CPF savings can I withdraw from age 55 to 64?"
 *     (`withdrawalsFrom55`): with the FRS set aside, "you can withdraw any
 *     amount from your Ordinary Account (OA)"; without it, "you can withdraw
 *     $5,000 from your OA".
 *
 * Timing. The transition runs at the end of the month the member turns 55,
 * after that month's contribution, interest credit and MediSave cap. So the
 * birthday month's contribution, still on the 55-and-below band, lands in the
 * SA and moves with it, and the SA earns interest for the whole of that month
 * while the RA starts earning the month after. Steps 1 to 5 happen in that
 * month; step 6 applies from the next, which is when CPF Board applies a new
 * age band's rates. Moving savings at the end of the month rather than the
 * start means neither account loses a month's interest on them.
 *
 * Reading of the rules. The pages that describe forming the RA say OA savings
 * go in after the SA's, up to the FRS, but not whether any are kept back. The
 * withdrawal page says a member short of the FRS "can withdraw $5,000 from
 * your OA", and its worked example has exactly that: a member turning 55 in
 * 2026 with $100,000 in the RA, short of the FRS, and $5,000 in the OA. Taking
 * every OA dollar into the RA would leave such a member nothing to withdraw,
 * contradicting both. So the OA tops up the RA only with savings above that
 * $5,000: a member who reaches the FRS keeps the rest of their OA, all of it
 * withdrawable, and one who does not keeps up to $5,000 in it. Revisit if CPF
 * Board states the formation rule directly.
 *
 * Out of scope here: CPF Board also says that OA savings above the $5,000 may
 * later be transferred to the RA to make up the FRS. That ongoing sweep is
 * not modelled; the transition happens once.
 */

import type { RuleSet } from '@/rules';
import type { AccountAmounts, Cents } from './types';

const CENTS_PER_DOLLAR = 100;

export interface SpecialAccountClosure {
  balances: AccountAmounts;
  /** Moved from the Special Account to the Retirement Account. */
  toRetirement: Cents;
  /** Moved from the Special Account to the Ordinary Account, which the RA had no room for. */
  toOrdinary: Cents;
}

/**
 * Empties the Special Account: into the Retirement Account up to the FRS,
 * then the rest to the Ordinary Account.
 *
 * The transition does this once, at 55. After that the SA is closed, but
 * interest it earned before closing is credited the following December, and
 * that credit has nowhere to stay; the loop sends it the same way.
 */
export function closeSpecialAccount(
  rules: RuleSet,
  balances: AccountAmounts,
  fullRetirementSum: Cents,
): SpecialAccountClosure {
  const room = Math.max(0, fullRetirementSum - balances.retirement);
  const toRetirement = Math.min(balances.special, room);
  const remainder = balances.special - toRetirement;
  let toOrdinary = 0;
  switch (rules.retirementAccount.specialAccountRemainderTo) {
    case 'ordinary':
      toOrdinary = remainder;
      break;
  }
  return {
    balances: {
      ordinary: balances.ordinary + toOrdinary,
      special: 0,
      medisave: balances.medisave,
      retirement: balances.retirement + toRetirement,
    },
    toRetirement,
    toOrdinary,
  };
}

/**
 * What a member aged 55 to 64 may withdraw: the whole Ordinary Account if the
 * FRS is set aside, and otherwise up to the rule set's fixed amount.
 */
export function withdrawableFrom55(
  rules: RuleSet,
  ordinaryBalance: Cents,
  fullRetirementSumSetAside: boolean,
): Cents {
  if (fullRetirementSumSetAside) return ordinaryBalance;
  const limit = rules.retirementAccount.withdrawableWithoutFullRetirementSum * CENTS_PER_DOLLAR;
  return Math.min(ordinaryBalance, limit);
}

export interface TransitionRequest {
  rules: RuleSet;
  /** Balances at the end of the 55th birthday month, before the transition. */
  balances: AccountAmounts;
  /** The cohort FRS, fixed in the year the member turns 55, in cents. */
  fullRetirementSum: Cents;
}

export interface TransitionResult {
  balances: AccountAmounts;
  transferredFromSpecial: Cents;
  transferredFromOrdinary: Cents;
  specialAccountRemainderToOrdinary: Cents;
  fullRetirementSumSetAside: boolean;
  withdrawable: Cents;
}

/** Steps 1 to 5 of the transition, in order. */
export function formRetirementAccount({
  rules,
  balances,
  fullRetirementSum,
}: TransitionRequest): TransitionResult {
  // 1. The Retirement Account exists from here. It may already hold savings,
  //    for example from an opening balance, which count towards the FRS.
  const formed = { ...balances };
  const transferred = { special: 0, ordinary: 0 };

  // 2 and 3. Fill it from each account in the published order, up to the FRS.
  //    The OA keeps back what a member short of the FRS may withdraw.
  const keptInOrdinary = rules.retirementAccount.withdrawableWithoutFullRetirementSum * CENTS_PER_DOLLAR;
  for (const account of rules.retirementAccount.fundedFrom) {
    const room = Math.max(0, fullRetirementSum - formed.retirement);
    const available =
      account === 'ordinary' ? Math.max(0, formed.ordinary - keptInOrdinary) : formed[account];
    const taken = Math.min(available, room);
    formed[account] -= taken;
    formed.retirement += taken;
    transferred[account] += taken;
  }

  // 4. Close the Special Account. The RA is full if anything is left in it.
  const closure = closeSpecialAccount(rules, formed, fullRetirementSum);

  // 5. Report what may be withdrawn, and leave it where it is.
  const fullRetirementSumSetAside = closure.balances.retirement >= fullRetirementSum;
  return {
    balances: closure.balances,
    transferredFromSpecial: transferred.special + closure.toRetirement,
    transferredFromOrdinary: transferred.ordinary,
    specialAccountRemainderToOrdinary: closure.toOrdinary,
    fullRetirementSumSetAside,
    withdrawable: withdrawableFrom55(rules, closure.balances.ordinary, fullRetirementSumSetAside),
  };
}
