import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { inRealTerms, realFactor } from './realTerms';

const FULL: FormValues = {
  ...DEFAULT_FORM,
  ordinaryBalance: 200_000,
  bonusMonths: 2,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
  housingGrant: 20_000,
  voluntaryRefundAge: 38,
  voluntaryRefundAmount: 30_000,
  selling: true,
  saleAge: 45,
  salePrice: 800_000,
  nextHousingPlan: 'hdb-loan',
  nextPropertyPrice: 900_000,
  nextDownpayment: 300_000,
  nextOrdinaryAccountSharePercent: 60,
  nextLoanTenureYears: 15,
};

const outcome = projectDraft(toDraft(FULL, '2026-10'));
if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
const nominal = outcome.result;
const RATE = 0.017;
const real = inRealTerms(nominal, RATE);

/** Numbers that are not money: they must come through untouched. */
const NOT_MONEY = new Set(['ageInMonths', 'rate', 'instalmentsPaid', 'escalatingAnnualRise']);

/** Walks two parallel values, calling `check` on every numeric leaf with its path. */
function walk(a: unknown, b: unknown, path: string, check: (path: string, a: number, b: number) => void) {
  if (typeof a === 'number' && typeof b === 'number') return check(path, a, b);
  if (a && typeof a === 'object') {
    for (const key of Object.keys(a)) walk((a as never)[key], (b as never)[key], `${path}.${key}`, check);
  }
}

describe('inRealTerms', () => {
  it('converts every money figure in every month, at that month’s price level', () => {
    let checked = 0;
    nominal.months.forEach((month, index) => {
      const factor = realFactor(nominal.input.startMonth, month.month, RATE);
      walk(month, real.months[index], `months[${index}]`, (path, n, r) => {
        const key = path.split('.').at(-1)!;
        if (NOT_MONEY.has(key)) expect(r, path).toBe(n);
        else expect(r, path).toBe(Math.round(n * factor));
        checked++;
      });
    });
    // Sale, refund, grant, bonus and both loans all appear somewhere above.
    expect(checked).toBeGreaterThan(10_000);
    const kinds = new Set(nominal.months.flatMap((m) => m.events.map((e) => e.kind)));
    expect([...kinds].sort()).toEqual(
      [
        'age-55-transition',
        'basic-healthcare-sum-reached',
        'housing-loan-cleared',
        'property-purchased',
        'property-sold',
        'voluntary-housing-refund',
      ].filter((k) => kinds.has(k as never)),
    );
    expect(kinds.has('property-sold')).toBe(true);
    expect(kinds.has('voluntary-housing-refund')).toBe(true);
  });

  it('converts every money figure in the summary, at the month it describes', () => {
    const month = (age: number) => nominal.months.find((m) => m.ageInMonths === age * 12)!.month;
    const factorAt = (stamp: string) => realFactor(nominal.input.startMonth, stamp, RATE);
    const expectScaled = (n: unknown, r: unknown, stamp: string, label: string) =>
      walk(n, r, label, (path, a, b) => {
        if (NOT_MONEY.has(path.split('.').at(-1)!)) return;
        expect(b, path).toBe(Math.round(a * factorAt(stamp)));
      });
    const { retirementSumsBasis: _b, ...at55 } = nominal.summary.atAge55!;
    const { retirementSumsBasis: _r, ...realAt55 } = real.summary.atAge55!;
    expectScaled(at55, realAt55, month(55), 'atAge55');
    expectScaled(nominal.summary.atEnd, real.summary.atEnd, nominal.months.at(-1)!.month, 'atEnd');
    expect(real.summary.cpfLife!.standardFrom65).toBe(
      Math.round(nominal.summary.cpfLife!.standardFrom65 * factorAt(month(65))),
    );
    // Totals are sums of the converted months, not the converted sum.
    expect(real.summary.totals.contributions).toBe(real.months.reduce((s, m) => s + m.contribution.total, 0));
  });

  it('restates the Escalating Plan’s rise net of inflation', () => {
    expect(real.summary.cpfLife!.escalatingAnnualRise).toBeCloseTo(1.02 / 1.017 - 1, 12);
  });

  it('leaves the first month as it is, and shrinks later ones', () => {
    expect(real.months[0]!.closingBalances).toEqual(nominal.months[0]!.closingBalances);
    const lastN = nominal.months.at(-1)!.closingBalances.retirement;
    expect(real.months.at(-1)!.closingBalances.retirement).toBeLessThan(lastN);
  });

  it('is the identity at zero inflation', () => {
    expect(inRealTerms(nominal, 0)).toBe(nominal);
  });

  it('turns $100 in 20 years at 2% into about $67 today', () => {
    expect(100 * realFactor('2026-01', '2046-01', 0.02)).toBeCloseTo(67.3, 1);
  });
});
