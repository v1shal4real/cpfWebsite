import type {
  AccountAmounts,
  Cents,
  MonthStamp,
  ProjectionEvent,
  ProjectionMonth,
  ProjectionResult,
  ProjectionSummary,
} from '@/engine/types';

/**
 * Nominal dollars to today's dollars, for display.
 *
 * The engine works in nominal dollars, as CPF does: a ceiling, a sum or a
 * balance is the figure in force in its own year. In real terms, every money
 * figure is divided by the price rise from the projection's first month to
 * its own, at a stated, editable inflation rate, so $100 in 20 years at 2% a
 * year reads as about $67 today. Applied once, to the whole result, so every
 * figure and chart that renders the result follows the toggle.
 *
 * Only money moves. Ages, months, rates and counts are left as they are; the
 * one rate that is about money's value over time, the Escalating Plan's
 * yearly rise, is restated net of inflation.
 */

const MONTHS_PER_YEAR = 12;

/** Months from `from` to `to`: `YYYY-MM` stamps. */
function monthsBetween(from: MonthStamp, to: MonthStamp): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * MONTHS_PER_YEAR + (tm - fm);
}

/** The factor that turns a figure in `month` into the first month's dollars. */
export function realFactor(start: MonthStamp, month: MonthStamp, annualRate: number): number {
  return (1 + annualRate) ** (-monthsBetween(start, month) / MONTHS_PER_YEAR);
}

const deflator =
  (factor: number) =>
  (cents: Cents): Cents =>
    Math.round(cents * factor);

function amounts(a: AccountAmounts, d: (c: Cents) => Cents): AccountAmounts {
  return {
    ordinary: d(a.ordinary),
    special: d(a.special),
    medisave: d(a.medisave),
    retirement: d(a.retirement),
  };
}

/** Event fields that are counts, not money. */
const EVENT_COUNTS = new Set(['instalmentsPaid']);

/** Every money field of an event, by its kind's shape: numbers, and account amounts. */
function event(e: ProjectionEvent, d: (c: Cents) => Cents): ProjectionEvent {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(e)) {
    if (typeof value === 'number' && !EVENT_COUNTS.has(key)) out[key] = d(value);
    else if (value && typeof value === 'object') out[key] = amounts(value as AccountAmounts, d);
    else out[key] = value;
  }
  return out as unknown as ProjectionEvent;
}

function month(m: ProjectionMonth, d: (c: Cents) => Cents): ProjectionMonth {
  const { contribution: c, interest: i, medisaveOverflow: o, loan, housing } = m;
  return {
    ...m,
    openingBalances: amounts(m.openingBalances, d),
    closingBalances: amounts(m.closingBalances, d),
    ordinaryWage: d(m.ordinaryWage),
    contribution: {
      ordinaryWageSubjectToCpf: d(c.ordinaryWageSubjectToCpf),
      total: d(c.total),
      employee: d(c.employee),
      employer: d(c.employer),
      allocation: amounts(c.allocation, d),
      additionalWage: d(c.additionalWage),
      additionalWageSubjectToCpf: d(c.additionalWageSubjectToCpf),
      onAdditionalWage: {
        total: d(c.onAdditionalWage.total),
        employee: d(c.onAdditionalWage.employee),
        employer: d(c.onAdditionalWage.employer),
      },
    },
    interest: {
      baseAccrued: amounts(i.baseAccrued, d),
      extraAccruedOn: amounts(i.extraAccruedOn, d),
      extraAccruedTo: amounts(i.extraAccruedTo, d),
      credited: amounts(i.credited, d),
    },
    medisaveOverflow: {
      basicHealthcareSum: d(o.basicHealthcareSum),
      amount: d(o.amount),
      to: amounts(o.to, d),
    },
    retirementTransfers: amounts(m.retirementTransfers, d),
    ...(loan && {
      loan: {
        rate: loan.rate,
        openingBalance: d(loan.openingBalance),
        drawn: d(loan.drawn),
        instalment: d(loan.instalment),
        interest: d(loan.interest),
        principal: d(loan.principal),
        closingBalance: d(loan.closingBalance),
      },
    }),
    ...(housing && {
      housing: {
        withdrawnFromOrdinaryAccount: d(housing.withdrawnFromOrdinaryAccount),
        paidInCash: d(housing.paidInCash),
        shortfallToCash: d(housing.shortfallToCash),
        ordinaryAccountRetention: d(housing.ordinaryAccountRetention),
        principalUsed: d(housing.principalUsed),
        accruedInterest: d(housing.accruedInterest),
        refundable: d(housing.refundable),
        grantUsed: d(housing.grantUsed),
        voluntaryRefund: d(housing.voluntaryRefund),
      },
    }),
    events: m.events.map((e) => event(e, d)),
  };
}

const sum = (months: readonly ProjectionMonth[], of: (m: ProjectionMonth) => Cents) =>
  months.reduce((total, m) => total + of(m), 0);
const total = (a: AccountAmounts) => a.ordinary + a.special + a.medisave + a.retirement;

/** The whole result in the first month's dollars, at `annualRate` inflation. */
export function inRealTerms(result: ProjectionResult, annualRate: number): ProjectionResult {
  if (annualRate === 0) return result;
  const start = result.input.startMonth;
  const at = (stamp: MonthStamp) => deflator(realFactor(start, stamp, annualRate));
  const months = result.months.map((m) => month(m, at(m.month)));
  const { summary } = result;

  // Each summary figure in the dollars of the month it describes.
  const monthOf = (ageInMonths: number) => result.months.find((m) => m.ageInMonths === ageInMonths)?.month;
  const last = result.months.at(-1)?.month ?? start;
  const at55 = monthOf(55 * MONTHS_PER_YEAR);
  const at65 = monthOf(65 * MONTHS_PER_YEAR);

  const real: ProjectionSummary = {
    atEnd: {
      balances: amounts(summary.atEnd.balances, at(last)),
      housingRefundable: at(last)(summary.atEnd.housingRefundable),
    },
    totals: {
      contributions: sum(months, (m) => m.contribution.total),
      interest: sum(months, (m) => total(m.interest.credited)),
      housingWithdrawals: sum(months, (m) => m.housing?.withdrawnFromOrdinaryAccount ?? 0),
    },
    ...(summary.atAge55 &&
      at55 && {
        atAge55: {
          ...summary.atAge55,
          balances: amounts(summary.atAge55.balances, at(at55)),
          retirementAccount: at(at55)(summary.atAge55.retirementAccount),
          basicRetirementSum: at(at55)(summary.atAge55.basicRetirementSum),
          fullRetirementSum: at(at55)(summary.atAge55.fullRetirementSum),
          withdrawable: at(at55)(summary.atAge55.withdrawable),
        },
      }),
    ...(summary.cpfLife &&
      at65 && {
        cpfLife: {
          premiumAt65: at(at65)(summary.cpfLife.premiumAt65),
          standardFrom65: at(at65)(summary.cpfLife.standardFrom65),
          // Five more years of prices by the time a deferred payout starts.
          standardFrom70: deflator(realFactor(start, at65, annualRate) / (1 + annualRate) ** 5)(
            summary.cpfLife.standardFrom70,
          ),
          escalatingFrom65: at(at65)(summary.cpfLife.escalatingFrom65),
          // A 2% nominal rise is a smaller real one.
          escalatingAnnualRise: (1 + summary.cpfLife.escalatingAnnualRise) / (1 + annualRate) - 1,
        },
      }),
  };

  return { ...result, months, summary: real };
}
