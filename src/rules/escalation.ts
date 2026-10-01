/**
 * The cohort sums for the years a projection reaches.
 *
 * The Full Retirement Sum is fixed for a cohort in the year it turns 55, and
 * the Basic Healthcare Sum is revised every year until a member turns 65 and
 * then fixed for life. A projection for a 30-year-old therefore needs the sums
 * of the 2050s, which nobody has published. These functions return the
 * published figure where CPF Board has one, and otherwise carry the last
 * published figure forward by the rule set's stated assumption.
 *
 * Every figure says which it is, through `basis`, so the interface can tell a
 * user which numbers are CPF Board's and which are this tool's assumption.
 *
 * Like the rest of `src/rules`, nothing here reads the clock: the year is
 * always an argument.
 */

import type { SourceId } from './sources';
import type { EscalatingSeries, RuleSet } from './types';

const BASIS_POINTS = 10_000;

/**
 * Where a figure came from.
 *
 *   - `published`: CPF Board's own figure for that year.
 *   - `assumed`: escalated from the last published year by the stated rate.
 *   - `before-published`: a year earlier than any figure recorded here, given
 *     the earliest recorded figure instead. Only reachable for members who
 *     turned 55 before mid-2015 or 65 before 2016.
 */
export type FigureBasis = 'published' | 'assumed' | 'before-published';

export interface YearFigure {
  year: number;
  /** In dollars, as the rule set publishes figures. */
  amount: number;
  basis: FigureBasis;
}

function publishedYears(series: EscalatingSeries): number[] {
  return Object.keys(series.published)
    .map(Number)
    .sort((a, b) => a - b);
}

/** The last year that has a published figure. */
export function lastPublishedYear(series: EscalatingSeries): number {
  const years = publishedYears(series);
  return years[years.length - 1]!;
}

/**
 * Raises an amount by a rate and rounds to the nearest step, half a step up.
 * Integer arithmetic throughout, so a forty-year run of these is exact.
 */
function escalateOnce(amount: number, rise: number, step: number): number {
  const factor = BASIS_POINTS + Math.round(rise * BASIS_POINTS);
  const unit = BASIS_POINTS * step;
  return Math.floor((amount * factor + unit / 2) / unit) * step;
}

/** A series' figure for a calendar year: published where it can be, assumed past that. */
export function figureForYear(series: EscalatingSeries, year: number): YearFigure {
  const published = series.published[year];
  if (published !== undefined) return { year, amount: published, basis: 'published' };

  const years = publishedYears(series);
  const first = years[0]!;
  if (year < first) return { year, amount: series.published[first]!, basis: 'before-published' };

  const last = years[years.length - 1]!;
  let amount = series.published[last]!;
  for (let step = last + 1; step <= year; step++) {
    amount = escalateOnce(amount, series.assumedAnnualRise, series.roundTo);
  }
  return { year, amount, basis: 'assumed' };
}

/* Retirement sums ---------------------------------------------------------- */

export interface CohortRetirementSums {
  /** The year the cohort turns 55, which fixes these sums for life. */
  yearTurning55: number;
  basicRetirementSum: number;
  fullRetirementSum: number;
  basis: FigureBasis;
}

/**
 * The Basic and Full Retirement Sums fixed for the cohort turning 55 in a year.
 *
 * CPF Board escalates the BRS and sets the FRS at a fixed multiple of it, so
 * the FRS is derived the same way here, by the ratio the rule set's own 2026
 * figures carry, rather than escalated separately and left to drift.
 */
export function retirementSumsForCohort(rules: RuleSet, yearTurning55: number): CohortRetirementSums {
  const basic = figureForYear(rules.escalation.basicRetirementSum, yearTurning55);
  const fullToBasic = rules.thresholds.fullRetirementSum / rules.thresholds.basicRetirementSum;
  return {
    yearTurning55,
    basicRetirementSum: basic.amount,
    fullRetirementSum: basic.amount * fullToBasic,
    basis: basic.basis,
  };
}

/* Basic Healthcare Sum ----------------------------------------------------- */

/** The Basic Healthcare Sum in force in a calendar year, for members below 65. */
export function basicHealthcareSumInYear(rules: RuleSet, year: number): YearFigure {
  return figureForYear(rules.escalation.basicHealthcareSum, year);
}

export interface MemberBasicHealthcareSum extends YearFigure {
  /** True from the year the member turns 65, when the sum stops changing. */
  fixed: boolean;
}

/**
 * The Basic Healthcare Sum that caps a member's MediSave in a year: the one in
 * force that year while they are below 65, and the one in force in the year
 * they turn 65 for every year after.
 */
export function basicHealthcareSumForMember(
  rules: RuleSet,
  year: number,
  yearTurning65: number,
): MemberBasicHealthcareSum {
  const fixed = year >= yearTurning65;
  return { ...basicHealthcareSumInYear(rules, fixed ? yearTurning65 : year), fixed };
}

/* Assumptions panel -------------------------------------------------------- */

export interface EscalationAssumption {
  id: 'retirementSums' | 'basicHealthcareSum';
  label: string;
  /** The first year the assumption is used for: the year after the last published figure. */
  appliesFrom: number;
  assumedAnnualRise: number;
  /** The rule set's own wording of what the rate rests on. */
  basis: string;
  /** The page the published figures, and so the starting point, come from. */
  sourceId: SourceId;
}

/** The escalation assumptions a rule set makes, worded for the assumptions panel. */
export function escalationAssumptions(rules: RuleSet): EscalationAssumption[] {
  const { escalation } = rules;
  return [
    {
      id: 'retirementSums',
      label: 'Retirement sums',
      appliesFrom: lastPublishedYear(escalation.basicRetirementSum) + 1,
      assumedAnnualRise: escalation.basicRetirementSum.assumedAnnualRise,
      basis: escalation.basicRetirementSum.basis,
      sourceId: escalation.sourceId,
    },
    {
      id: 'basicHealthcareSum',
      label: 'Basic Healthcare Sum',
      appliesFrom: lastPublishedYear(escalation.basicHealthcareSum) + 1,
      assumedAnnualRise: escalation.basicHealthcareSum.assumedAnnualRise,
      basis: escalation.basicHealthcareSum.basis,
      sourceId: escalation.fieldSources?.basicHealthcareSum ?? escalation.sourceId,
    },
  ];
}
