/**
 * The monthly time-step loop.
 *
 * `project` walks one month at a time from the member's age at the start to
 * the end age, resolving the rules in force for each step and recording what
 * that month did. It is a pure function of its input: no clock, no globals,
 * no mutation of what it was given, so the same input always produces an
 * identical result and a shared link renders the same figures in a year.
 *
 * Rules are resolved per step rather than once, which is what stops a
 * projection reaching 2041 from applying today's figures. Today's rule set is
 * the only one recorded so far, so every month currently resolves to it, and
 * the moment a second dated set is added the loop starts switching on its own.
 *
 * Each month, in order: the wage is raised if it is the raise month, the
 * contribution is computed and allocated, base and extra interest are accrued
 * on the month's opening balances, and in December the year's interest is
 * credited, with extra interest earned on the Ordinary Account landing in the
 * Special or Retirement Account.
 * Interest is accrued before this month's contribution lands, which is how a
 * contribution comes to earn only from the following month.
 *
 * What this loop does not do yet: housing, the Basic Healthcare Sum cap and
 * the age-55 transition each have their own ticket, and each fills in the part
 * of `ProjectionMonth` it owns. Anything reading this
 * output should treat the missing parts as "not implemented yet" rather than
 * as a result.
 *
 * Interest accrued in a year the projection ends partway through is not
 * credited, because CPF would not have credited it yet either. Opening
 * balances are taken to have had any earlier interest already credited, so a
 * projection starting mid-year credits only the months it covers in its first
 * December.
 *
 * A wage at or below the rule set's `fullRatesFromMonthlyWage` makes the
 * contribution step throw, because no rule set encodes CPF's graduated rates
 * for low wages. Input validation is where that should be caught and explained.
 */

import { resolveRuleSet } from '@/rules';
import { allocateContribution } from './allocation';
import { addMonths, monthToIsoDate, parseMonth } from './calendar';
import { NO_CONTRIBUTIONS_YET, contributionForMonth, type YearToDate } from './contributions';
import {
  CREDITING_MONTH,
  NOTHING_ACCRUED,
  accrueInterest,
  creditInterest,
  earningBalances,
  type AccruedThisYear,
} from './interest';
import type {
  AccountAmounts,
  Cents,
  ProjectionInput,
  ProjectionMonth,
  ProjectionResult,
  ProjectionSummary,
} from './types';

const MONTHS_PER_YEAR = 12;

/** Age in months at which the retirement rules change. */
const AGE_55_IN_MONTHS = 55 * MONTHS_PER_YEAR;

function zero(): AccountAmounts {
  return { ordinary: 0, special: 0, medisave: 0, retirement: 0 };
}

function copy(balances: AccountAmounts): AccountAmounts {
  return { ...balances };
}

function add(a: AccountAmounts, b: AccountAmounts): AccountAmounts {
  return {
    ordinary: a.ordinary + b.ordinary,
    special: a.special + b.special,
    medisave: a.medisave + b.medisave,
    retirement: a.retirement + b.retirement,
  };
}

/**
 * The month this member turns 55, which may fall before the projection starts.
 *
 * The retirement sums that fix for a cohort are the ones in force in that
 * month, so both the loop and the summary read them from its rule set.
 */
function monthTurning55(input: ProjectionInput): string {
  return addMonths(input.startMonth, AGE_55_IN_MONTHS - input.startAge * MONTHS_PER_YEAR);
}

/** Rule-set thresholds are published in dollars; the engine works in cents. */
function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/**
 * Whether the annual raise lands at the start of this month.
 *
 * Salary growth is applied once a year, in `salaryGrowth.appliedInMonth`, and
 * never in the first month: the wage given as input is the wage being earned
 * now, so raising it immediately would credit a raise that has not happened.
 * A projection starting in the raise month therefore gets its first raise a
 * year later.
 */
function isRaiseMonth(input: ProjectionInput, step: number, calendarMonth: number): boolean {
  return step > 0 && calendarMonth === input.salaryGrowth.appliedInMonth;
}

/**
 * Runs a projection.
 *
 * `endAge` is inclusive: the last month is the one in which the member reaches
 * it, so a 30-year-old projected to 65 gets 421 months.
 */
export function project(input: ProjectionInput): ProjectionResult {
  const steps = (input.endAge - input.startAge) * MONTHS_PER_YEAR + 1;
  const months: ProjectionMonth[] = [];
  const ruleSetIds: string[] = [];

  let balances = copy(input.openingBalances);
  let ordinaryWage = input.monthlyOrdinaryWage;
  // The ceilings that count across a year are per calendar year, so this
  // resets in January rather than on the projection's own anniversary.
  let yearToDate: YearToDate = { ...NO_CONTRIBUTIONS_YET };
  let yearInProgress = parseMonth(input.startMonth).year;
  // Interest earned this year and not yet credited. Reset when it is credited
  // in December, so it never carries across a year.
  let accruedThisYear: AccruedThisYear = { ...NOTHING_ACCRUED };
  // TODO: the age-55 transition ticket owns this figure and records it on its
  // event. Until then it is read here from the cohort's rule set.
  const fullRetirementSum = toCents(
    resolveRuleSet(monthToIsoDate(monthTurning55(input))).thresholds.fullRetirementSum,
  );

  for (let step = 0; step < steps; step++) {
    const month = addMonths(input.startMonth, step);
    const { year, month: calendarMonth } = parseMonth(month);
    const ageInMonths = input.startAge * MONTHS_PER_YEAR + step;
    const ruleSet = resolveRuleSet(monthToIsoDate(month));
    if (ruleSetIds.at(-1) !== ruleSet.id) ruleSetIds.push(ruleSet.id);

    if (year !== yearInProgress) {
      yearToDate = { ...NO_CONTRIBUTIONS_YET };
      yearInProgress = year;
    }

    if (isRaiseMonth(input, step, calendarMonth)) {
      ordinaryWage = Math.round(ordinaryWage * (1 + input.salaryGrowth.rate));
    }

    const contribution = contributionForMonth({
      rules: ruleSet,
      ageInMonths,
      ordinaryWage,
      yearToDate,
    });
    yearToDate = {
      ordinaryWagesSubjectToCpf:
        yearToDate.ordinaryWagesSubjectToCpf + contribution.ordinaryWageSubjectToCpf,
      contributions: yearToDate.contributions + contribution.total,
    };

    const openingBalances = copy(balances);
    const allocation = allocateContribution({
      rules: ruleSet,
      ageInMonths,
      total: contribution.total,
      retirementBalance: openingBalances.retirement,
      fullRetirementSum,
    });

    // Accrued on the opening balances, so this month's contribution earns
    // from next month. TODO: housing withdrawals are subtracted here once the
    // housing ticket records them, since they stop earning in the month they
    // leave.
    const interest = accrueInterest({
      rules: ruleSet,
      ageInMonths,
      earning: earningBalances(openingBalances),
      accruedThisYear,
    });
    accruedThisYear = interest.accruedThisYear;
    let credited = zero();
    if (calendarMonth === CREDITING_MONTH) {
      credited = creditInterest(accruedThisYear);
      accruedThisYear = { ...NOTHING_ACCRUED };
    }

    // TODO: housing and the Basic Healthcare Sum cap move balances too, each
    // in its own ticket.
    const closingBalances = add(add(openingBalances, allocation), credited);

    months.push({
      month,
      ageInMonths,
      ruleSetId: ruleSet.id,
      openingBalances,
      closingBalances,
      ordinaryWage,
      contribution: {
        ...contribution,
        allocation,
      },
      interest: {
        baseAccrued: interest.baseAccrued,
        extraAccruedOn: interest.extraAccruedOn,
        extraAccruedTo: interest.extraAccruedTo,
        credited,
      },
      events: [],
    });

    balances = closingBalances;
  }

  return {
    input,
    months,
    summary: summarise(months),
    ruleSetIds,
  };
}

function summarise(months: readonly ProjectionMonth[]): ProjectionSummary {
  const last = months.at(-1);
  if (!last) {
    // A projection of no months is possible only from an input the validation
    // ticket rejects. Summarising it as empty beats throwing from a pure
    // function the interface calls on every keystroke.
    return {
      atEnd: { balances: zero(), housingRefundable: 0 },
      totals: { contributions: 0, interest: 0, housingWithdrawals: 0 },
    };
  }

  const summary: ProjectionSummary = {
    atEnd: {
      balances: copy(last.closingBalances),
      housingRefundable: last.housing?.refundable ?? 0,
    },
    totals: {
      contributions: sum(months, (month) => month.contribution.total),
      interest: sum(months, (month) => total(month.interest.credited)),
      housingWithdrawals: sum(months, (month) => month.housing?.withdrawnFromOrdinaryAccount ?? 0),
    },
  };

  const atAge55 = months.find((month) => month.ageInMonths === AGE_55_IN_MONTHS);
  if (atAge55) {
    // The sums that fix for this cohort are the ones in force in the year the
    // member turns 55, so they are read from that month's rule set rather than
    // from the current one.
    const { thresholds } = resolveRuleSet(monthToIsoDate(atAge55.month));
    summary.atAge55 = {
      balances: copy(atAge55.closingBalances),
      retirementAccount: atAge55.closingBalances.retirement,
      basicRetirementSum: toCents(thresholds.basicRetirementSum),
      fullRetirementSum: toCents(thresholds.fullRetirementSum),
      // TODO: set by the age-55 transition, which decides how much sits above
      // the retirement sum. Zero until that ticket lands.
      withdrawable: 0,
    };
  }

  return summary;
}

function sum(months: readonly ProjectionMonth[], of: (month: ProjectionMonth) => Cents): Cents {
  let running = 0;
  for (const month of months) running += of(month);
  return running;
}

function total(amounts: AccountAmounts): Cents {
  return amounts.ordinary + amounts.special + amounts.medisave + amounts.retirement;
}
