import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';
import { BASE_INTEREST_FIXTURES } from './__fixtures__';
import {
  CREDITING_MONTH,
  NOTHING_ACCRUED,
  accrueBaseInterest,
  creditInterest,
  earningBalances,
  type AccruedThisYear,
} from './interest';
import type { AccountAmounts, AccountName } from './types';

const ACCOUNTS: readonly AccountName[] = ['ordinary', 'special', 'medisave', 'retirement'];

const balances = (given: Partial<AccountAmounts> = {}): AccountAmounts => ({
  ordinary: 0,
  special: 0,
  medisave: 0,
  retirement: 0,
  ...given,
});

/**
 * Runs a calendar year the way the loop does: each month accrues on the
 * balances at its start, then that month's receipts land, and the year is
 * credited after December.
 */
function runYear(
  rules: RuleSet,
  opening: AccountAmounts,
  receipts: readonly { month: number; account: AccountName; amount: number }[] = [],
) {
  let held = { ...opening };
  let accrued: AccruedThisYear = { ...NOTHING_ACCRUED };
  const monthly: AccountAmounts[] = [];
  for (let month = 1; month <= 12; month++) {
    const step = accrueBaseInterest({ rules, earning: earningBalances(held), accruedThisYear: accrued });
    accrued = step.accruedThisYear;
    monthly.push(step.baseAccrued);
    for (const paid of receipts) {
      if (paid.month === month) held = { ...held, [paid.account]: held[paid.account] + paid.amount };
    }
  }
  return { credited: creditInterest(accrued), monthly };
}

/** The 2026 rule set with different base rates, to show the rates come from the rule set. */
const withRates = (rates: Partial<Record<AccountName, number>>): RuleSet => ({
  ...CURRENT_RULE_SET,
  interest: { ...CURRENT_RULE_SET.interest, ...rates },
});

describe('derived fixtures', () => {
  it.each(BASE_INTEREST_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s matches exactly',
    (_id, fixture) => {
      const { credited } = runYear(
        CURRENT_RULE_SET,
        balances(fixture.openingBalances),
        fixture.contributions,
      );
      for (const account of ACCOUNTS) {
        expect(credited[account], account).toBe(fixture.expected[account] ?? 0);
      }
    },
  );

  it('covers every fixture', () => {
    expect(BASE_INTEREST_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('computation', () => {
  it('earns a twelfth of each account’s annual rate a month', () => {
    const { baseAccrued } = accrueBaseInterest({
      rules: CURRENT_RULE_SET,
      earning: balances({ ordinary: 4_800_000, special: 3_000_000, medisave: 3_000_000, retirement: 3_000_000 }),
      accruedThisYear: NOTHING_ACCRUED,
    });
    // $48,000 x 2.5% / 12 = $100; $30,000 x 4% / 12 = $100.
    expect(baseAccrued).toEqual({ ordinary: 10_000, special: 10_000, medisave: 10_000, retirement: 10_000 });
  });

  it('reads every rate from the rule set it is given', () => {
    const rules = withRates({ ordinary: 0.03, special: 0.05, medisave: 0.06, retirement: 0.012 });
    const { baseAccrued } = accrueBaseInterest({
      rules,
      earning: balances({ ordinary: 1_200_000, special: 1_200_000, medisave: 1_200_000, retirement: 1_200_000 }),
      accruedThisYear: NOTHING_ACCRUED,
    });
    // A twelfth of a year on $12,000 at each rate: 3% -> $30, 5% -> $50, 6% -> $60, 1.2% -> $12.
    expect(baseAccrued).toEqual({ ordinary: 3_000, special: 5_000, medisave: 6_000, retirement: 1_200 });
  });

  it('holds no rate of its own', () => {
    // Rates are parameters. A literal rate in the calculation path would
    // silently survive a change to the rule set.
    const source = readFileSync(join(process.cwd(), 'src', 'engine', 'interest.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*/g, ' ');
    expect(source).not.toMatch(/\b0?\.\d+\b/);
  });

  it('earns nothing on money received this month until the next', () => {
    const { monthly } = runYear(CURRENT_RULE_SET, balances(), [
      { month: 3, account: 'special', amount: 3_000_000 },
    ]);
    expect(monthly.slice(0, 3).map((month) => month.special)).toEqual([0, 0, 0]);
    expect(monthly[3]?.special).toBe(10_000);
  });

  it('stops earning on money withdrawn from the month it leaves', () => {
    expect(earningBalances(balances({ ordinary: 5_000_000 }), { ordinary: 2_000_000 })).toEqual(
      balances({ ordinary: 3_000_000 }),
    );
    // A withdrawal can never make a balance earn negative interest.
    expect(earningBalances(balances({ ordinary: 100 }), { ordinary: 500 }).ordinary).toBe(0);
  });
});

describe('crediting and rounding', () => {
  it('credits the year’s interest in December', () => {
    expect(CREDITING_MONTH).toBe(12);
  });

  it('keeps the year exact and rounds once, when credited', () => {
    // $1.92 in OA earns 0.4c a month. Rounded monthly that is 0c x 12 = 0c;
    // kept exact it is 4.8c for the year, which credits 5c.
    const { credited, monthly } = runYear(CURRENT_RULE_SET, balances({ ordinary: 192 }));
    expect(credited.ordinary).toBe(5);
    // The months still add up to exactly what is credited.
    expect(monthly.reduce((sum, month) => sum + month.ordinary, 0)).toBe(credited.ordinary);
  });

  it('rounds half a cent up', () => {
    // 20c in OA earns exactly half a cent for the year: rounds up to 1c.
    expect(runYear(CURRENT_RULE_SET, balances({ ordinary: 20 })).credited.ordinary).toBe(1);
    // 16c earns 0.4c: rounds down to nothing.
    expect(runYear(CURRENT_RULE_SET, balances({ ordinary: 16 })).credited.ordinary).toBe(0);
  });

  it('does not compound within the year', () => {
    // Twelve months of $100 on $48,000 OA, not interest on interest.
    const { credited } = runYear(CURRENT_RULE_SET, balances({ ordinary: 4_800_000 }));
    expect(credited.ordinary).toBe(120_000);
  });
});
