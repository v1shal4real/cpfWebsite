import { describe, expect, it } from 'vitest';
import { applyVoluntaryRefund, type AccruedInterestState } from './accruedInterest';
import { projectDraft } from './project';
import type { ProjectionMonth } from './types';
import type { ProjectionDraft } from './validate';

/** 12 units of a twelfth of a basis point = one cent, as `accruedInterest.ts` keeps them. */
const CENT_UNITS = 10_000 * 12;

const owed: AccruedInterestState = {
  principalUsed: 10_000_000,
  credited: 400_000,
  accruingThisYear: 50_000 * CENT_UNITS,
};

describe('applyVoluntaryRefund', () => {
  it('reduces the principal first', () => {
    const result = applyVoluntaryRefund(owed, 3_000_000);
    expect(result).toMatchObject({ refunded: 3_000_000, toPrincipal: 3_000_000, toInterest: 0 });
    expect(result.state.principalUsed).toBe(7_000_000);
    expect(result.state.credited).toBe(400_000);
  });

  it('then the accrued interest: credited years first, then this year', () => {
    const result = applyVoluntaryRefund(owed, 10_000_000 + 420_000);
    expect(result).toMatchObject({ toPrincipal: 10_000_000, toInterest: 420_000 });
    expect(result.state.principalUsed).toBe(0);
    expect(result.state.credited).toBe(0);
    expect(result.state.accruingThisYear).toBe(30_000 * CENT_UNITS);
  });

  it('caps the refund at everything owed', () => {
    const result = applyVoluntaryRefund(owed, 99_000_000);
    expect(result.refunded).toBe(10_000_000 + 400_000 + 50_000);
    expect(result.state).toEqual({ principalUsed: 0, credited: 0, accruingThisYear: 0 });
  });

  it('does nothing with a zero or negative amount', () => {
    expect(applyVoluntaryRefund(owed, 0)).toMatchObject({ refunded: 0, state: owed });
    expect(applyVoluntaryRefund(owed, -5).refunded).toBe(0);
  });
});

const HDB: ProjectionDraft = {
  startMonth: '2026-01',
  currentAge: 30,
  monthlySalary: 600_000,
  salaryGrowthRate: 0,
  balances: { ordinary: 20_000_000 },
  housingPlan: 'hdb-loan',
  propertyPrice: 50_000_000,
  purchaseAge: 32,
  downpayment: 12_500_000,
  downpaymentShareFromOrdinaryAccount: 1,
  loanTenureYears: 25,
};

const run = (draft: ProjectionDraft) => {
  const outcome = projectDraft(draft);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.result;
};
const at = (months: readonly ProjectionMonth[], age: number) =>
  months.find((m) => m.ageInMonths === age * 12)!;

describe('a voluntary refund in the projection', () => {
  const without = run(HDB);
  const withRefund = run({ ...HDB, voluntaryRefundAge: 40, voluntaryRefundAmount: 5_000_000 });
  const month = at(withRefund.months, 40);
  const event = month.events.find((e) => e.kind === 'voluntary-housing-refund');

  it('reduces the principal by the refund, and records it', () => {
    if (event?.kind !== 'voluntary-housing-refund') throw new Error('no refund');
    expect(event).toMatchObject({
      asked: 5_000_000,
      refunded: 5_000_000,
      toPrincipal: 5_000_000,
      toInterest: 0,
    });
    expect(month.housing?.voluntaryRefund).toBe(5_000_000);
    const before = at(withRefund.months, 40).housing!.principalUsed;
    const sameMonthWithout = at(without.months, 40).housing!.principalUsed;
    expect(sameMonthWithout - before).toBe(5_000_000);
  });

  it('credits it to the Ordinary Account below 55', () => {
    if (event?.kind !== 'voluntary-housing-refund') throw new Error('no refund');
    expect(event.refundedToOrdinary).toBe(5_000_000);
    expect(event.refundedToRetirement).toBe(0);
    expect(month.closingBalances.ordinary - at(without.months, 40).closingBalances.ordinary).toBe(5_000_000);
  });

  it('accrues less interest from then on, so less is owed later', () => {
    const owedAt = (r: typeof without, age: number) => at(r.months, age).housing!;
    // Principal gap stays the refund; the interest gap grows each year.
    const gap50 = owedAt(without, 50).accruedInterest - owedAt(withRefund, 50).accruedInterest;
    const gap60 = owedAt(without, 60).accruedInterest - owedAt(withRefund, 60).accruedInterest;
    expect(gap50).toBeGreaterThan(0);
    expect(gap60).toBeGreaterThan(gap50);
    expect(owedAt(without, 50).principalUsed - owedAt(withRefund, 50).principalUsed).toBe(5_000_000);
  });

  it('is capped at what is owed', () => {
    const huge = run({ ...HDB, voluntaryRefundAge: 33, voluntaryRefundAmount: 900_000_000 });
    const e = at(huge.months, 33).events.find((x) => x.kind === 'voluntary-housing-refund');
    if (e?.kind !== 'voluntary-housing-refund') throw new Error('no refund');
    expect(e.refunded).toBeLessThan(e.asked);
    expect(e.refundableAfter).toBe(0);
  });

  it('stops all further CPF withdrawals after a full refund, instalments included', () => {
    const full = run({ ...HDB, voluntaryRefundAge: 33, voluntaryRefundAmount: 900_000_000 });
    const after = full.months.filter((m) => m.ageInMonths >= 33 * 12 && m.housing);
    expect(after.length).toBeGreaterThan(12);
    expect(after.every((m) => m.housing!.withdrawnFromOrdinaryAccount === 0)).toBe(true);
    // The instalments are still paid, in cash.
    const instalments = after.filter((m) => (m.loan?.instalment ?? 0) > 0);
    expect(instalments.length).toBeGreaterThan(12);
    expect(instalments.every((m) => m.housing!.paidInCash === m.loan!.instalment)).toBe(true);
  });

  it('leaves withdrawals running after a partial refund', () => {
    const later = withRefund.months.find((m) => m.ageInMonths === 40 * 12 + 1)!;
    expect(later.housing!.withdrawnFromOrdinaryAccount).toBeGreaterThan(0);
  });

  it('from 55, tops up the Retirement Account to the FRS first, the rest to the OA', () => {
    const later = run({ ...HDB, voluntaryRefundAge: 56, voluntaryRefundAmount: 30_000_000 });
    const e = at(later.months, 56).events.find((x) => x.kind === 'voluntary-housing-refund');
    if (e?.kind !== 'voluntary-housing-refund') throw new Error('no refund');
    expect(e.refundedToRetirement + e.refundedToOrdinary).toBe(e.refunded);
    const raBefore = at(later.months, 56).openingBalances.retirement;
    const frs = later.summary.atAge55!.fullRetirementSum;
    expect(e.refundedToRetirement).toBe(
      Math.min(
        e.refunded,
        Math.max(0, frs - raBefore - at(later.months, 56).contribution.allocation.retirement),
      ),
    );
  });

  it('means less is refunded on a later sale', () => {
    const sale = { saleAge: 50, salePrice: 90_000_000 };
    const refundDue = (draft: ProjectionDraft) => {
      const e = at(run(draft).months, 50).events.find((x) => x.kind === 'property-sold');
      if (e?.kind !== 'property-sold') throw new Error('no sale');
      return e.refundDue;
    };
    expect(refundDue({ ...HDB, ...sale })).toBeGreaterThan(
      refundDue({ ...HDB, ...sale, voluntaryRefundAge: 40, voluntaryRefundAmount: 5_000_000 }) + 5_000_000,
    );
  });

  it('is rejected before the purchase', () => {
    const outcome = projectDraft({ ...HDB, voluntaryRefundAge: 31, voluntaryRefundAmount: 100 });
    expect(outcome.ok ? [] : outcome.errors.map((e) => `${e.field}:${e.code}`)).toContain(
      'voluntaryRefundAge:before-purchase',
    );
  });
});
