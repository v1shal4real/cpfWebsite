import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, RULE_SETS } from '@/rules';
import { escalatingPayoutAt, estimateCpfLife, payoutFromTable } from './cpfLife';
import { projectDraft } from './project';

const rules = CURRENT_RULE_SET.cpfLife;
const table = rules.standardTable;

describe('the published CPF LIFE table', () => {
  it('runs in ascending order of premium, with payouts rising', () => {
    for (const set of RULE_SETS) {
      const rows = set.cpfLife.standardTable;
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.premiumAt65).toBeGreaterThan(rows[i - 1]!.premiumAt65);
        expect(rows[i]!.monthlyFrom65).toBeGreaterThan(rows[i - 1]!.monthlyFrom65);
        expect(rows[i]!.monthlyFrom70).toBeGreaterThan(rows[i]!.monthlyFrom65);
      }
    }
  });

  it('pays close to the same per dollar of premium across the table', () => {
    // $5 to $6 a month per $1,000: what makes reading between rows sound.
    for (const row of table) {
      const perThousand = (row.monthlyFrom65 / row.premiumAt65) * 1_000;
      expect(perThousand).toBeGreaterThan(5);
      expect(perThousand).toBeLessThan(6);
    }
  });
});

describe('payoutFromTable', () => {
  it('reproduces every published row exactly', () => {
    for (const row of table) {
      expect(payoutFromTable(table, row.premiumAt65, 'monthlyFrom65')).toBeCloseTo(row.monthlyFrom65, 9);
      expect(payoutFromTable(table, row.premiumAt65, 'monthlyFrom70')).toBeCloseTo(row.monthlyFrom70, 9);
    }
  });

  it('reads straight-line between rows', () => {
    // Halfway between the FRS row ($330,100 → $1,780) and the next ($445,600 → $2,380).
    expect(payoutFromTable(table, (330_100 + 445_600) / 2, 'monthlyFrom65')).toBeCloseTo(2_080, 6);
  });

  it('reads in proportion outside the table, and pays nothing on nothing', () => {
    expect(payoutFromTable(table, 41_200, 'monthlyFrom65')).toBeCloseTo(245, 6);
    expect(payoutFromTable(table, 1_300_200, 'monthlyFrom65')).toBeCloseTo(6_880, 6);
    expect(payoutFromTable(table, 0, 'monthlyFrom65')).toBe(0);
  });

  it('never pays less for a larger premium', () => {
    let previous = 0;
    for (let premium = 0; premium <= 1_000_000; premium += 5_000) {
      const payout = payoutFromTable(table, premium, 'monthlyFrom65');
      expect(payout).toBeGreaterThanOrEqual(previous);
      previous = payout;
    }
  });
});

describe('estimateCpfLife', () => {
  const estimate = estimateCpfLife(rules, 33_010_000);

  it('gives the Standard Plan from 65 and from 70, to the dollar', () => {
    expect(estimate.standardFrom65).toBe(178_000);
    expect(estimate.standardFrom70).toBe(238_000);
  });

  it('starts the Escalating Plan 20% lower and raises it 2% a year', () => {
    expect(estimate.escalatingFrom65).toBe(142_400);
    expect(escalatingPayoutAt(estimate, 65)).toBe(142_400);
    expect(escalatingPayoutAt(estimate, 66)).toBe(145_200);
    // CPF's own example: $1,000 at 65 reaches "around $1,500" at 85.
    const thousand = { ...estimate, escalatingFrom65: 100_000 };
    expect(escalatingPayoutAt(thousand, 85)).toBe(148_600);
  });

  it('overtakes the Standard Plan in time', () => {
    const crossover = [...Array(40).keys()]
      .map((years) => 65 + years)
      .find((age) => escalatingPayoutAt(estimate, age) > estimate.standardFrom65);
    expect(crossover).toBeDefined();
    expect(crossover!).toBeGreaterThan(70);
  });
});

describe('the estimate in a projection', () => {
  it('is read from the Retirement Account at the end of the 65th birthday month', () => {
    const outcome = projectDraft({
      startMonth: '2026-10',
      currentAge: 30,
      monthlySalary: 500_000,
      salaryGrowthRate: 0,
      housingPlan: 'none',
    });
    if (!outcome.ok) throw new Error('should project');
    const at65 = outcome.result.months.find((m) => m.ageInMonths === 65 * 12)!;
    expect(outcome.result.summary.cpfLife?.premiumAt65).toBe(at65.closingBalances.retirement);
    expect(outcome.result.summary.cpfLife?.standardFrom65).toBeGreaterThan(0);
  });
});
