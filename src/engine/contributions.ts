/**
 * Monthly CPF contributions on Ordinary Wages.
 *
 * Three caps apply, in the order CPF Board applies them: the Ordinary Wage
 * ceiling on the month's wage, the annual salary ceiling on the wages counted
 * across the year, and the Annual Limit on the contributions themselves. Every
 * figure comes from the rule set handed in, so a month in 2041 is computed
 * with 2041's ceilings.
 *
 * Rounding follows the steps printed on CPF Board's rate table, in order:
 *
 *   1. Round the total contribution to the nearest dollar, with 50 cents
 *      rounding up.
 *   2. Round the employee's share down to the dollar.
 *   3. The employer pays the difference.
 *
 * The third step is why the employer's share is never computed from its own
 * rate: the rounding remainder belongs to the employer, and computing it
 * directly would disagree with CPF Board's worked examples by a dollar.
 */

import { bandForAge } from '@/rules';
import type { ContributionBand, RuleSet } from '@/rules';
import type { Cents } from './types';

const CENTS_PER_DOLLAR = 100;
const BASIS_POINTS = 10_000;
/** One dollar, in the cents-times-basis-points units the rounding works in. */
const DOLLAR = CENTS_PER_DOLLAR * BASIS_POINTS;

/** Contributions counted so far in the calendar year, for the annual caps. */
export interface YearToDate {
  /** Ordinary Wages already subject to CPF this year. */
  ordinaryWagesSubjectToCpf: Cents;
  /** Contributions already payable this year, employee and employer together. */
  contributions: Cents;
}

export const NO_CONTRIBUTIONS_YET: YearToDate = {
  ordinaryWagesSubjectToCpf: 0,
  contributions: 0,
};

export interface ContributionAmounts {
  /** The part of this month's wage that attracted CPF, after the ceilings. */
  ordinaryWageSubjectToCpf: Cents;
  total: Cents;
  employee: Cents;
  employer: Cents;
}

/**
 * The age a contribution band is chosen by, from an age in whole months.
 *
 * CPF applies a new band from the month after the birthday month, so a member
 * who turns 55 in June is still on the 55-and-below rates for June and moves
 * to the next band in July. Rounding the age up expresses exactly that: the
 * birthday month keeps the old band, and every month after it takes the new
 * one. CPF Board's own Additional Wage examples switch rates on this boundary.
 */
export function bandAge(ageInMonths: number): number {
  return Math.ceil(ageInMonths / 12);
}

/** The age in years from which the retirement rules apply. */
const RETIREMENT_RULES_AGE = 55;

/**
 * Whether the from-55 rules apply: from the month after the 55th birthday
 * month, the boundary every age band uses. The allocation routing, the extra
 * interest tiers and the MediSave overflow all switch here, so they read it
 * from one place rather than each deciding for itself. The age-55 transition
 * ticket owns this boundary.
 */
export function onFrom55Rules(ageInMonths: number): boolean {
  return bandAge(ageInMonths) > RETIREMENT_RULES_AGE;
}

/** The contribution band in force for a member of this age, from the rule set. */
export function bandForMonth(rules: RuleSet, ageInMonths: number): ContributionBand {
  const band = bandForAge(rules.contributionRates.bands, bandAge(ageInMonths));
  if (!band) {
    // Only reachable if a rule set has no open-ended final band, which the
    // rule-set tests forbid.
    throw new RangeError(`No contribution band for age ${bandAge(ageInMonths)} in ${rules.id}`);
  }
  return band;
}

/**
 * Applies a band's rates to an amount of wages, with CPF Board's rounding.
 *
 * Exported because CPF Board's worked examples round each wage component on
 * its own, so the fixtures exercise this directly.
 */
export function contributionOnWage(
  wageSubjectToCpf: Cents,
  band: ContributionBand,
): Omit<ContributionAmounts, 'ordinaryWageSubjectToCpf'> {
  const rate = (fraction: number) => Math.round(fraction * BASIS_POINTS);
  const totalRate = rate(band.employee) + rate(band.employer);

  // Half up for the total, down for the employee's share.
  const total =
    Math.floor((wageSubjectToCpf * totalRate + DOLLAR / 2) / DOLLAR) * CENTS_PER_DOLLAR;
  const employee =
    Math.floor((wageSubjectToCpf * rate(band.employee)) / DOLLAR) * CENTS_PER_DOLLAR;

  return { total, employee, employer: total - employee };
}

export interface ContributionRequest {
  rules: RuleSet;
  ageInMonths: number;
  /** The month's Ordinary Wages, before any ceiling. */
  ordinaryWage: Cents;
  yearToDate: YearToDate;
}

/**
 * Contributions payable for one month.
 *
 * Wages at or below the rule set's `fullRatesFromMonthlyWage` throw: CPF
 * Board publishes graduated rates for them which no rule set encodes yet, and
 * applying the full rates would overstate the contribution. Input validation
 * is expected to reject such a wage before it reaches here, which is where
 * that limitation should surface to the user.
 */
export function contributionForMonth({
  rules,
  ageInMonths,
  ordinaryWage,
  yearToDate,
}: ContributionRequest): ContributionAmounts {
  const { wageCeilings, contributionRates } = rules;
  const fullRatesFrom = contributionRates.fullRatesFromMonthlyWage * CENTS_PER_DOLLAR;
  if (ordinaryWage <= fullRatesFrom) {
    throw new RangeError(
      `Monthly wages of ${ordinaryWage} cents or less attract graduated rates, which ${rules.id} does not encode`,
    );
  }

  // The monthly ceiling first, then whatever room the annual salary ceiling
  // leaves. For Ordinary Wages alone the annual ceiling cannot bind — twelve
  // months at the monthly ceiling fall short of it — but Additional Wages
  // share the same allowance, so the engine applies it rather than assume.
  const monthlyCeiling = wageCeilings.ordinaryWageCeiling * CENTS_PER_DOLLAR;
  const annualCeiling = wageCeilings.annualSalaryCeiling * CENTS_PER_DOLLAR;
  const annualRoom = Math.max(0, annualCeiling - yearToDate.ordinaryWagesSubjectToCpf);
  const ordinaryWageSubjectToCpf = Math.min(ordinaryWage, monthlyCeiling, annualRoom);

  const band = bandForMonth(rules, ageInMonths);
  const uncapped = contributionOnWage(ordinaryWageSubjectToCpf, band);

  // The Annual Limit caps mandatory and voluntary contributions together. Like
  // the annual salary ceiling it cannot bind on Ordinary Wages alone; it is
  // applied so that voluntary contributions and Additional Wages cannot later
  // slip past it.
  const limitRoom = Math.max(0, wageCeilings.annualLimit * CENTS_PER_DOLLAR - yearToDate.contributions);
  if (uncapped.total <= limitRoom) {
    return { ordinaryWageSubjectToCpf, ...uncapped };
  }

  // Over the limit: the excess is not payable. The employee's share is kept
  // whole where the room allows and the employer's share absorbs the cut,
  // matching how the rounding remainder is assigned.
  const total = limitRoom;
  const employee = Math.min(uncapped.employee, total);
  return { ordinaryWageSubjectToCpf, total, employee, employer: total - employee };
}
