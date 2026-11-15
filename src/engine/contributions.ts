/**
 * Monthly CPF contributions on Ordinary Wages and Additional Wages (bonuses).
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
  /** Additional Wages already subject to CPF this year, against the AW ceiling. */
  additionalWagesSubjectToCpf: Cents;
  /** Contributions already payable this year, employee and employer together. */
  contributions: Cents;
}

export const NO_CONTRIBUTIONS_YET: YearToDate = {
  ordinaryWagesSubjectToCpf: 0,
  additionalWagesSubjectToCpf: 0,
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
  const total = Math.floor((wageSubjectToCpf * totalRate + DOLLAR / 2) / DOLLAR) * CENTS_PER_DOLLAR;
  const employee = Math.floor((wageSubjectToCpf * rate(band.employee)) / DOLLAR) * CENTS_PER_DOLLAR;

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

/* Additional Wages ---------------------------------------------------------- */

/**
 * The Additional Wage ceiling for a calendar year: the annual salary ceiling
 * less the Ordinary Wages subject to CPF that year.
 *
 * CPF Board: "$102,000 - Total Ordinary Wages (OW) subject to CPF for the
 * year". An employer estimates the year's OW at each AW payment and
 * re-calculates in December; a projection knows the year's wages already, so
 * it applies the December figure throughout, and each year's total AW subject
 * to CPF matches CPF Board's examples after their re-calculation.
 */
export function additionalWageCeiling(rules: RuleSet, ordinaryWagesSubjectToCpfForYear: Cents): Cents {
  const annual = rules.wageCeilings.annualSalaryCeiling * CENTS_PER_DOLLAR;
  return Math.max(0, annual - ordinaryWagesSubjectToCpfForYear);
}

/**
 * Ordinary Wages subject to CPF over a calendar year, from each month's wage
 * and the OW ceiling in force that month, capped at the annual ceiling.
 */
export function ordinaryWagesSubjectToCpfForYear(
  months: readonly { ordinaryWage: Cents; rules: RuleSet }[],
): Cents {
  let total = 0;
  for (const { ordinaryWage, rules } of months) {
    const monthly = rules.wageCeilings.ordinaryWageCeiling * CENTS_PER_DOLLAR;
    const annual = rules.wageCeilings.annualSalaryCeiling * CENTS_PER_DOLLAR;
    total = Math.min(annual, total + Math.min(ordinaryWage, monthly));
  }
  return total;
}

export interface AdditionalWageRequest {
  rules: RuleSet;
  ageInMonths: number;
  /** Additional Wages paid this month, before the AW ceiling. */
  additionalWage: Cents;
  /** This year's AW ceiling, from `additionalWageCeiling`. */
  ceiling: Cents;
  /** Including this month's Ordinary Wage contribution, which is computed first. */
  yearToDate: YearToDate;
}

export interface AdditionalWageAmounts {
  /** The part of this month's AW that attracted CPF, after the AW ceiling. */
  additionalWageSubjectToCpf: Cents;
  total: Cents;
  employee: Cents;
  employer: Cents;
}

export const NO_ADDITIONAL_WAGE: AdditionalWageAmounts = {
  additionalWageSubjectToCpf: 0,
  total: 0,
  employee: 0,
  employer: 0,
};

/**
 * Contributions on one month's Additional Wages.
 *
 * At the rates for the month the AW is paid, so a bonus paid after the 55th
 * birthday month takes the 55-to-60 rates (CPF Board's Example 10). Rounded on
 * its own, apart from the month's OW contribution, as CPF Board's tables do.
 * The Annual Limit covers OW and AW together.
 */
export function contributionOnAdditionalWage({
  rules,
  ageInMonths,
  additionalWage,
  ceiling,
  yearToDate,
}: AdditionalWageRequest): AdditionalWageAmounts {
  if (additionalWage <= 0) return NO_ADDITIONAL_WAGE;
  const room = Math.max(0, ceiling - yearToDate.additionalWagesSubjectToCpf);
  const additionalWageSubjectToCpf = Math.min(additionalWage, room);
  const uncapped = contributionOnWage(additionalWageSubjectToCpf, bandForMonth(rules, ageInMonths));

  const limitRoom = Math.max(0, rules.wageCeilings.annualLimit * CENTS_PER_DOLLAR - yearToDate.contributions);
  if (uncapped.total <= limitRoom) return { additionalWageSubjectToCpf, ...uncapped };
  const employee = Math.min(uncapped.employee, limitRoom);
  return { additionalWageSubjectToCpf, total: limitRoom, employee, employer: limitRoom - employee };
}
