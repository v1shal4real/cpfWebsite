import type { AccountAmounts, ProjectionMonth, ProjectionResult } from '@/engine/types';

/**
 * The timeline's pure parts: keyboard stepping and the readout at an age.
 * Kept out of the component so both are testable without a DOM, and so the
 * readout is a lookup, never a recomputation: scrubbing must not touch the engine.
 */

/** Months to move for a key, or a target to jump to. `null` for keys the timeline does not handle. */
export function nextAgeInMonths(
  current: number,
  key: string,
  { shift, min, max }: { shift: boolean; min: number; max: number },
): number | null {
  let next: number;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      next = current + (shift ? 1 : 12);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      next = current - (shift ? 1 : 12);
      break;
    case 'PageUp':
      next = current + 60;
      break;
    case 'PageDown':
      next = current - 60;
      break;
    case 'Home':
      next = min;
      break;
    case 'End':
      next = max;
      break;
    default:
      return null;
  }
  return Math.min(max, Math.max(min, next));
}

export interface TimelineReadout {
  ageInMonths: number;
  month: ProjectionMonth['month'];
  /** Closing balances that month, in dollars. */
  balances: AccountAmounts;
  total: number;
  /**
   * Contribution on the Ordinary Wage as a share of the OW subject to CPF;
   * `null` when no wage is subject to CPF. A bonus is left out, so the rate
   * reads the same in a bonus month as in any other.
   */
  contributionRate: number | null;
  employeeRate: number | null;
  employerRate: number | null;
  /** Share of the month's contribution going to each account; `null` when there was no contribution. */
  allocationShares: AccountAmounts | null;
  /** Present in a bonus month. Dollars. */
  bonus: { paid: number; subjectToCpf: number; contribution: number } | null;
  /** Present once CPF has been used for housing. Dollars. */
  housing: { principalUsed: number; accruedInterest: number; refundable: number } | null;
  /** Present in the month of a voluntary housing refund. Dollars. */
  voluntaryRefund: {
    refunded: number;
    toPrincipal: number;
    toInterest: number;
    refundableAfter: number;
  } | null;
}

/** Marks for the timeline: the moments a projection changes course, by age in months. */
export function timelineMarks(result: ProjectionResult): { value: number; label: string }[] {
  const marks: { value: number; label: string }[] = [];
  for (const month of result.months) {
    for (const event of month.events) {
      const label =
        event.kind === 'property-purchased'
          ? event.afterSale
            ? 'Next home bought'
            : 'Home bought'
          : event.kind === 'voluntary-housing-refund'
            ? 'Voluntary housing refund'
            : event.kind === 'property-sold'
              ? 'Home sold'
              : event.kind === 'age-55-transition'
                ? 'Age 55: Retirement Account formed'
                : null;
      if (label) marks.push({ value: month.ageInMonths, label });
    }
  }
  return marks;
}

const dollars = (cents: number) => cents / 100;

/** Looks up the month by age. Months are consecutive, so this is an index, not a search. */
export function monthAt(result: ProjectionResult, ageInMonths: number): ProjectionMonth | undefined {
  const first = result.months[0];
  if (!first) return undefined;
  return result.months[ageInMonths - first.ageInMonths];
}

export function readoutAt(result: ProjectionResult, ageInMonths: number): TimelineReadout | null {
  const month = monthAt(result, ageInMonths);
  if (!month) return null;
  const b = month.closingBalances;
  const balances: AccountAmounts = {
    ordinary: dollars(b.ordinary),
    special: dollars(b.special),
    medisave: dollars(b.medisave),
    retirement: dollars(b.retirement),
  };
  const { contribution, housing } = month;
  const wage = contribution.ordinaryWageSubjectToCpf;
  const share = (part: number) => (contribution.total > 0 ? part / contribution.total : 0);
  return {
    ageInMonths: month.ageInMonths,
    month: month.month,
    balances,
    total: balances.ordinary + balances.special + balances.medisave + balances.retirement,
    contributionRate: wage > 0 ? (contribution.total - contribution.onAdditionalWage.total) / wage : null,
    employeeRate: wage > 0 ? (contribution.employee - contribution.onAdditionalWage.employee) / wage : null,
    employerRate: wage > 0 ? (contribution.employer - contribution.onAdditionalWage.employer) / wage : null,
    bonus:
      contribution.additionalWage > 0
        ? {
            paid: dollars(contribution.additionalWage),
            subjectToCpf: dollars(contribution.additionalWageSubjectToCpf),
            contribution: dollars(contribution.onAdditionalWage.total),
          }
        : null,
    allocationShares:
      contribution.total > 0
        ? {
            ordinary: share(contribution.allocation.ordinary),
            special: share(contribution.allocation.special),
            medisave: share(contribution.allocation.medisave),
            retirement: share(contribution.allocation.retirement),
          }
        : null,
    // Shown while anything is owed: after a refund that clears the principal,
    // accrued interest can still be outstanding.
    housing:
      housing && housing.refundable > 0
        ? {
            principalUsed: dollars(housing.principalUsed),
            accruedInterest: dollars(housing.accruedInterest),
            refundable: dollars(housing.refundable),
          }
        : null,
    voluntaryRefund: (() => {
      const event = month.events.find((each) => each.kind === 'voluntary-housing-refund');
      return event?.kind === 'voluntary-housing-refund'
        ? {
            refunded: dollars(event.refunded),
            toPrincipal: dollars(event.toPrincipal),
            toInterest: dollars(event.toInterest),
            refundableAfter: dollars(event.refundableAfter),
          }
        : null;
    })(),
  };
}
