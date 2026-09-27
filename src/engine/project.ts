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
 * What this loop does not do yet: allocation, interest, housing and the
 * age-55 transition each have their own ticket, and each fills in the part of
 * `ProjectionMonth` it owns. Contributions are computed, but until allocation
 * lands there is nowhere to put them, so balances still carry forward
 * unchanged. Anything reading this output should treat a flat balance line as
 * "not implemented yet" rather than as a result.
 *
 * A wage at or below the rule set's `fullRatesFromMonthlyWage` makes the
 * contribution step throw, because no rule set encodes CPF's graduated rates
 * for low wages. Input validation is where that should be caught and explained.
 */

import { resolveRuleSet } from '@/rules';
import { addMonths, monthToIsoDate, parseMonth } from './calendar';
import { NO_CONTRIBUTIONS_YET, contributionForMonth, type YearToDate } from './contributions';
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
    // TODO: allocation decides which accounts this month's contribution lands
    // in, and interest and housing move balances too. Until those tickets
    // land, a month changes no balance.
    const closingBalances = copy(openingBalances);

    months.push({
      month,
      ageInMonths,
      ruleSetId: ruleSet.id,
      openingBalances,
      closingBalances,
      ordinaryWage,
      contribution: {
        ...contribution,
        // TODO: KAN allocation ticket splits this across the accounts.
        allocation: zero(),
      },
      interest: {
        baseAccrued: zero(),
        extraAccruedOn: zero(),
        extraAccruedTo: zero(),
        credited: zero(),
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
