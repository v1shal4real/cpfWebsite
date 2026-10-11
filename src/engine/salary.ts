/**
 * The wage path: how the monthly Ordinary Wage moves over a projection.
 *
 * Kept on its own so the loop and the validator share one definition. The
 * validator needs to know the lowest wage a projection will reach, because a
 * wage that falls to the graduated-rate threshold makes the contribution step
 * refuse it; if the two computed the path separately they could disagree.
 */

import { addMonths, parseMonth } from './calendar';
import type { Cents, ProjectionInput } from './types';

const MONTHS_PER_YEAR = 12;

/**
 * Whether the annual raise lands at the start of this month.
 *
 * Salary growth is applied once a year, in `salaryGrowth.appliedInMonth`, and
 * never in the first month: the wage given as input is the wage being earned
 * now, so raising it immediately would credit a raise that has not happened.
 * A projection starting in the raise month therefore gets its first raise a
 * year later.
 */
export function isRaiseMonth(input: ProjectionInput, step: number, calendarMonth: number): boolean {
  return step > 0 && calendarMonth === input.salaryGrowth.appliedInMonth;
}

/** The wage after one annual raise, to the nearest cent. A negative rate is a pay cut. */
export function raiseWage(wage: Cents, rate: number): Cents {
  return Math.round(wage * (1 + rate));
}

/**
 * The lowest monthly wage the projection will apply. With growth of zero or
 * more that is the starting wage; with a pay cut each year, the last one.
 */
export function lowestWage(input: ProjectionInput): Cents {
  const steps = (input.endAge - input.startAge) * MONTHS_PER_YEAR + 1;
  let wage = input.monthlyOrdinaryWage;
  let lowest = wage;
  for (let step = 1; step < steps; step++) {
    const { month } = parseMonth(addMonths(input.startMonth, step));
    if (isRaiseMonth(input, step, month)) {
      wage = raiseWage(wage, input.salaryGrowth.rate);
      lowest = Math.min(lowest, wage);
    }
  }
  return lowest;
}
