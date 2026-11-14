import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { monthAt, nextAgeInMonths, readoutAt } from './timelineState';

const range = { shift: false, min: 30 * 12, max: 65 * 12 };

describe('timeline keyboard', () => {
  it.each([
    ['ArrowRight', false, 40 * 12 + 12],
    ['ArrowUp', false, 40 * 12 + 12],
    ['ArrowLeft', false, 40 * 12 - 12],
    ['ArrowRight', true, 40 * 12 + 1],
    ['ArrowLeft', true, 40 * 12 - 1],
    ['PageUp', false, 45 * 12],
    ['PageDown', false, 35 * 12],
    ['Home', false, 30 * 12],
    ['End', false, 65 * 12],
  ] as const)('%s (shift %s) from 40 goes to %i months', (key, shift, expected) => {
    expect(nextAgeInMonths(40 * 12, key, { ...range, shift })).toBe(expected);
  });

  it('clamps to the ends', () => {
    expect(nextAgeInMonths(64 * 12, 'PageUp', range)).toBe(65 * 12);
    expect(nextAgeInMonths(30 * 12, 'ArrowLeft', range)).toBe(30 * 12);
  });

  it('ignores other keys so the browser keeps them', () => {
    expect(nextAgeInMonths(40 * 12, 'Tab', range)).toBeNull();
  });
});

const project = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  return outcome.result;
};

describe('readout', () => {
  const result = project(DEFAULT_FORM);

  it('looks months up by age', () => {
    for (const age of [30 * 12, 42 * 12 + 7, 65 * 12]) expect(monthAt(result, age)?.ageInMonths).toBe(age);
  });

  it('reports balances, rates and allocation that add up', () => {
    const r = readoutAt(result, 40 * 12)!;
    expect(r.total).toBeCloseTo(
      r.balances.ordinary + r.balances.special + r.balances.medisave + r.balances.retirement,
      6,
    );
    expect(r.contributionRate).toBeCloseTo((r.employeeRate ?? 0) + (r.employerRate ?? 0), 6);
    const s = r.allocationShares!;
    expect(s.ordinary + s.special + s.medisave + s.retirement).toBeCloseTo(1, 6);
    expect(r.housing).toBeNull();
  });

  it('shows the accrued interest position once CPF is used for housing', () => {
    const r = readoutAt(
      project({
        ...DEFAULT_FORM,
        housingPlan: 'hdb-loan',
        propertyPrice: 500_000,
        purchaseAge: 32,
        downpayment: 125_000,
        ordinaryAccountSharePercent: 75,
        loanTenureYears: 25,
      }),
      45 * 12,
    )!;
    expect(r.housing).not.toBeNull();
    expect(r.housing!.refundable).toBeCloseTo(r.housing!.principalUsed + r.housing!.accruedInterest, 2);
  });

  it('returns null outside the projection', () => {
    expect(readoutAt(result, 10 * 12)).toBeNull();
  });
});
