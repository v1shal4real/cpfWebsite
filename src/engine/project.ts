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
 * on the month's opening balances, in December the year's interest is
 * credited, with extra interest earned on the Ordinary Account landing in the
 * Special or Retirement Account, and finally MediSave is held to the Basic
 * Healthcare Sum and anything above it moved on. Interest is accrued before
 * this month's contribution lands, which is how a contribution comes to earn
 * only from the following month. The cap comes after the credit so that it
 * catches whatever took MediSave over, contribution or interest.
 *
 * In the month the member turns 55, the age-55 transition runs last of all:
 * the Retirement Account is formed from the Special Account, then the
 * Ordinary Account, up to the cohort FRS, and the Special Account closes. The
 * from-55 rates, ratios and tiers apply from the month after. In every later
 * month, anything credited to the closed Special Account is moved on the same
 * way. See `transition.ts` for the order and its sources.
 *
 * With a housing plan, the loan is drawn in the month the member reaches the
 * purchase age and repaid in monthly instalments from the month after, at the
 * rate the rules in force give each month; see `loan.ts`. The downpayment and
 * each instalment are paid from the Ordinary Account or in cash as the member
 * chose, after this month's contribution lands and before interest is
 * accrued, so money withdrawn stops earning in the month it leaves. The OA
 * never goes below the retained amount, and whatever it cannot cover falls to
 * cash; see `housing.ts`. Every OA withdrawal adds to the CPF principal used
 * for housing, which accrues interest at the rule set's accrued interest rate,
 * compounded annually, from the month it is withdrawn; see
 * `accruedInterest.ts`. Each month records the refund due if the property
 * were sold then.
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

import {
  basicHealthcareSumForMember,
  resolveRuleSet,
  retirementSumsForCohort,
  type CohortRetirementSums,
  type RuleSet,
} from '@/rules';
import { allocateContribution } from './allocation';
import { addMonths, monthToIsoDate, parseMonth } from './calendar';
import {
  NO_CONTRIBUTIONS_YET,
  contributionForMonth,
  onFrom55Rules,
  type YearToDate,
} from './contributions';
import {
  CREDITING_MONTH,
  NOTHING_ACCRUED,
  accrueInterest,
  creditInterest,
  earningBalances,
  type AccruedThisYear,
} from './interest';
import { NO_HOUSING_USE, accrueHousingInterest, type AccruedInterestState } from './accruedInterest';
import { housingPayments } from './housing';
import { drawLoan, repayLoan, type LoanMonth, type LoanState } from './loan';
import { capMedisave } from './medisave';
import { isRaiseMonth, raiseWage } from './salary';
import { closeSpecialAccount, formRetirementAccount } from './transition';
import type {
  AccountAmounts,
  Cents,
  ProjectionEvent,
  ProjectionInput,
  ProjectionMonth,
  ProjectionResult,
  ProjectionSummary,
} from './types';
import {
  validateProjectionInput,
  type FieldAdjustment,
  type FieldError,
  type ProjectionDraft,
} from './validate';

const MONTHS_PER_YEAR = 12;

/** Age in months at which the retirement rules change. */
const AGE_55_IN_MONTHS = 55 * MONTHS_PER_YEAR;

/** Age in months at which the Basic Healthcare Sum fixes for life. */
const AGE_65_IN_MONTHS = 65 * MONTHS_PER_YEAR;

function zero(): AccountAmounts {
  return { ordinary: 0, special: 0, medisave: 0, retirement: 0 };
}

function copy(balances: AccountAmounts): AccountAmounts {
  return { ...balances };
}

/** Per account, what moved from `before` to `after`. */
function difference(after: AccountAmounts, before: AccountAmounts): AccountAmounts {
  return {
    ordinary: after.ordinary - before.ordinary,
    special: after.special - before.special,
    medisave: after.medisave - before.medisave,
    retirement: after.retirement - before.retirement,
  };
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

/**
 * The Basic and Full Retirement Sums fixed for this member's cohort.
 *
 * Read for the year the member turns 55, from the rule set in force then. For
 * a year past the last published cohort that rule set is the newest one, and
 * the sums are carried forward by its stated escalation assumption, so a
 * 30-year-old is held to a sum for the 2050s rather than to today's.
 */
function cohortRetirementSums(input: ProjectionInput): CohortRetirementSums {
  const month = monthTurning55(input);
  return retirementSumsForCohort(resolveRuleSet(monthToIsoDate(month), input.rulesAsAt), parseMonth(month).year);
}

/** The calendar year this member turns 65, when their Basic Healthcare Sum fixes. */
function yearTurning65(input: ProjectionInput): number {
  const month = addMonths(input.startMonth, AGE_65_IN_MONTHS - input.startAge * MONTHS_PER_YEAR);
  return parseMonth(month).year;
}

/** Rule-set thresholds are published in dollars; the engine works in cents. */
function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** The year-dependent caps the MediSave overflow works to, in cents. */
interface YearCaps {
  /** This year's BHS below 65, then the one fixed in the year the member turned 65. */
  basicHealthcareSum: Cents;
  /**
   * The FRS in force this year: the sum for the cohort turning 55 in it. Below
   * 55 the overflow fills the Special Account towards it.
   */
  currentFullRetirementSum: Cents;
}

/**
 * Both change only on 1 January, so the loop resolves them once a year, from
 * the rule set in force for the year's first month it steps through.
 */
function capsForYear(rules: RuleSet, year: number, fixesBasicHealthcareSumIn: number): YearCaps {
  return {
    basicHealthcareSum: toCents(basicHealthcareSumForMember(rules, year, fixesBasicHealthcareSumIn).amount),
    currentFullRetirementSum: toCents(retirementSumsForCohort(rules, year).fullRetirementSum),
  };
}

export type DraftProjection =
  | { ok: true; result: ProjectionResult; adjustments: FieldAdjustment[] }
  | { ok: false; errors: FieldError[] };

/**
 * Validates a draft from the form and, if it can be projected, projects it.
 *
 * The interface's entry point. It never throws: an input the engine cannot
 * project comes back as typed field errors instead, and a value that was
 * clamped comes back as an adjustment alongside the result.
 */
export function projectDraft(draft: ProjectionDraft): DraftProjection {
  const validated = validateProjectionInput(draft);
  if (!validated.ok) return validated;
  return { ok: true, result: project(validated.input), adjustments: validated.adjustments };
}

/**
 * Runs a projection.
 *
 * `endAge` is inclusive: the last month is the one in which the member reaches
 * it, so a 30-year-old projected to 65 gets 421 months.
 *
 * Trusts its input: a wage at or below the graduated-rate threshold throws,
 * and other out-of-range values give meaningless results. Anything built from
 * user input should come through `projectDraft`, which validates first.
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
  // Fixed for the cohort in the year it turns 55: the transition fills the
  // Retirement Account to this, and the summary reports it.
  const retirementSums = cohortRetirementSums(input);
  const fullRetirementSum = toCents(retirementSums.fullRetirementSum);
  const fixesBasicHealthcareSumIn = yearTurning65(input);
  let caps: YearCaps | undefined;
  // Recorded once, the first month MediSave reaches the Basic Healthcare Sum.
  let basicHealthcareSumReached = false;
  // The housing loan, drawn in the month the member reaches the purchase age.
  // A purchase with no loan, or none in the projection, never draws one.
  // A purchase age before the start age is rejected by `validate.ts`; given
  // one directly, the loop would simply never reach the month to draw it.
  const loanTerms = input.housing && input.housing.loan.principal > 0 ? input.housing.loan : undefined;
  const purchaseStep = input.housing
    ? (input.housing.purchaseAge - input.startAge) * MONTHS_PER_YEAR
    : undefined;
  let loan: LoanState | undefined;
  // CPF principal used for the property and the interest it has accrued:
  // what must be refunded on sale.
  let housingUse: AccruedInterestState = { ...NO_HOUSING_USE };

  for (let step = 0; step < steps; step++) {
    const month = addMonths(input.startMonth, step);
    const { year, month: calendarMonth } = parseMonth(month);
    const ageInMonths = input.startAge * MONTHS_PER_YEAR + step;
    const ruleSet = resolveRuleSet(monthToIsoDate(month), input.rulesAsAt);
    if (ruleSetIds.at(-1) !== ruleSet.id) ruleSetIds.push(ruleSet.id);

    if (year !== yearInProgress) {
      yearToDate = { ...NO_CONTRIBUTIONS_YET };
      yearInProgress = year;
      caps = undefined;
    }
    caps ??= capsForYear(ruleSet, year, fixesBasicHealthcareSumIn);

    if (isRaiseMonth(input, step, calendarMonth)) {
      ordinaryWage = raiseWage(ordinaryWage, input.salaryGrowth.rate);
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

    // The loan: drawn in the purchase month, an instalment due each month after.
    let loanMonth: LoanMonth | undefined;
    if (loanTerms && step === purchaseStep) loanMonth = drawLoan(loanTerms, ruleSet);
    else if (loan) loanMonth = repayLoan(loan, ruleSet);
    loan = loanMonth && !loanMonth.cleared ? loanMonth.state : undefined;

    // Paying for the property, from the purchase month on. The OA can draw
    // on this month's contribution, which has landed by now.
    const owning = input.housing !== undefined && purchaseStep !== undefined && step >= purchaseStep;
    const payments =
      owning && input.housing
        ? housingPayments({
            rules: ruleSet,
            plan: input.housing,
            isPurchaseMonth: step === purchaseStep,
            instalmentDue: loanMonth?.record.instalment ?? 0,
            ordinaryAvailable: openingBalances.ordinary + allocation.ordinary,
          })
        : undefined;
    const withdrawnFromOrdinaryAccount = payments?.withdrawnFromOrdinaryAccount ?? 0;
    const refund = payments
      ? accrueHousingInterest({
          rules: ruleSet,
          state: housingUse,
          withdrawn: withdrawnFromOrdinaryAccount,
          calendarMonth,
        })
      : undefined;
    if (refund) housingUse = refund.state;

    // Accrued on the opening balances less this month's withdrawals: this
    // month's contribution earns from next month, and money withdrawn stops
    // earning from the month it leaves.
    const interest = accrueInterest({
      rules: ruleSet,
      ageInMonths,
      earning: earningBalances(openingBalances, { ordinary: withdrawnFromOrdinaryAccount }),
      accruedThisYear,
    });
    accruedThisYear = interest.accruedThisYear;
    let credited = zero();
    if (calendarMonth === CREDITING_MONTH) {
      credited = creditInterest(accruedThisYear);
      accruedThisYear = { ...NOTHING_ACCRUED };
    }

    // Below 55 the overflow fills SA towards this year's FRS; from 55 it
    // fills RA towards the member's own cohort FRS.
    const capped = capMedisave({
      rules: ruleSet,
      ageInMonths,
      balances: add(add(add(openingBalances, allocation), credited), {
        ordinary: -withdrawnFromOrdinaryAccount,
        special: 0,
        medisave: 0,
        retirement: 0,
      }),
      basicHealthcareSum: caps.basicHealthcareSum,
      fullRetirementSum: onFrom55Rules(ageInMonths) ? fullRetirementSum : caps.currentFullRetirementSum,
    });

    let closingBalances = capped.balances;

    // Events in the order they happen within the month: the purchase or the
    // loan instalment, then the MediSave cap, then the age-55 transition.
    const events: ProjectionEvent[] = [];
    if (input.housing && payments && step === purchaseStep) {
      events.push({
        kind: 'property-purchased',
        fromOrdinaryAccount: payments.withdrawnFromOrdinaryAccount,
        fromCash: payments.paidInCash,
        loanPrincipal: loanTerms?.principal ?? 0,
      });
    }
    if (loanMonth?.cleared) {
      events.push({
        kind: 'housing-loan-cleared',
        principal: loanMonth.state.terms.principal,
        instalmentsPaid: loanMonth.state.instalmentsPaid,
        totalInterestPaid: loanMonth.state.totalInterestPaid,
      });
    }
    if (!basicHealthcareSumReached && closingBalances.medisave >= caps.basicHealthcareSum) {
      basicHealthcareSumReached = true;
      events.push({
        kind: 'basic-healthcare-sum-reached',
        basicHealthcareSum: caps.basicHealthcareSum,
        overflow: capped.overflow.amount,
        overflowTo: capped.overflow.to,
      });
    }

    // Once, at the end of the 55th birthday month. A projection that starts
    // after it never sees the transition; its opening balances are taken as
    // already formed, and any Special Account balance in them is moved on by
    // the branch below in the first month.
    let retirementTransfers = zero();
    if (ageInMonths === AGE_55_IN_MONTHS) {
      const transition = formRetirementAccount({
        rules: ruleSet,
        balances: closingBalances,
        fullRetirementSum,
      });
      retirementTransfers = difference(transition.balances, closingBalances);
      closingBalances = transition.balances;
      events.push({
        kind: 'age-55-transition',
        transferredFromSpecial: transition.transferredFromSpecial,
        transferredFromOrdinary: transition.transferredFromOrdinary,
        specialAccountRemainderToOrdinary: transition.specialAccountRemainderToOrdinary,
        retirementAccount: closingBalances.retirement,
        fullRetirementSum,
        fullRetirementSumSetAside: transition.fullRetirementSumSetAside,
        withdrawable: transition.withdrawable,
        from55RulesApplyFrom: addMonths(month, 1),
      });
    } else if (ageInMonths > AGE_55_IN_MONTHS && closingBalances.special > 0) {
      // The Special Account is closed. Interest it earned before closing is
      // credited the following December, and goes where its savings went.
      const closure = closeSpecialAccount(ruleSet, closingBalances, fullRetirementSum);
      retirementTransfers = difference(closure.balances, closingBalances);
      closingBalances = closure.balances;
    }

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
      medisaveOverflow: capped.overflow,
      retirementTransfers,
      ...(loanMonth && { loan: loanMonth.record }),
      ...(payments &&
        refund && {
          housing: {
            ...payments,
            principalUsed: refund.principalUsed,
            accruedInterest: refund.accruedInterest,
            refundable: refund.refundable,
          },
        }),
      events,
    });

    balances = closingBalances;
  }

  return {
    input,
    months,
    summary: summarise(months, retirementSums),
    ruleSetIds,
  };
}

function summarise(
  months: readonly ProjectionMonth[],
  retirementSums: CohortRetirementSums,
): ProjectionSummary {
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
    // The sums fixed for this cohort in the year it turns 55, not today's.
    const transition = atAge55.events.find((event) => event.kind === 'age-55-transition');
    summary.atAge55 = {
      balances: copy(atAge55.closingBalances),
      retirementAccount: atAge55.closingBalances.retirement,
      basicRetirementSum: toCents(retirementSums.basicRetirementSum),
      fullRetirementSum: toCents(retirementSums.fullRetirementSum),
      retirementSumsBasis: retirementSums.basis,
      // Reported, never withdrawn.
      withdrawable: transition?.withdrawable ?? 0,
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
