import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';
import { BASE_INTEREST_FIXTURES, EXTRA_INTEREST_FIXTURES } from './__fixtures__';
import {
  CREDITING_MONTH,
  NOTHING_ACCRUED,
  accrueInterest,
  countForExtraInterest,
  creditInterest,
  earningBalances,
  extraInterestDestination,
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

const sumMonths = (months: readonly AccountAmounts[]): AccountAmounts => {
  const total = balances();
  for (const month of months) for (const account of ACCOUNTS) total[account] += month[account];
  return total;
};

const totalOf = (amounts: AccountAmounts) => ACCOUNTS.reduce((sum, account) => sum + amounts[account], 0);

/** The birthday month of an age, which is still inside that age's band. */
const AGE_40 = 40 * 12;
const AGE_60 = 60 * 12;

/**
 * Runs a calendar year the way the loop does: each month accrues on the
 * balances at its start, less that month's withdrawals, then that month's
 * receipts land, and the year is credited after December.
 */
function runYear(
  rules: RuleSet,
  opening: AccountAmounts,
  {
    ageInMonths = AGE_40,
    receipts = [],
    withdrawn = {},
  }: {
    ageInMonths?: number;
    receipts?: readonly { month: number; account: AccountName; amount: number }[];
    /** Withdrawn in January, so it earns nothing all year. */
    withdrawn?: Partial<AccountAmounts>;
  } = {},
) {
  let held = { ...opening };
  let accrued: AccruedThisYear = { ...NOTHING_ACCRUED };
  const base: AccountAmounts[] = [];
  const extraOn: AccountAmounts[] = [];
  const extraTo: AccountAmounts[] = [];
  for (let month = 1; month <= 12; month++) {
    const step = accrueInterest({
      rules,
      ageInMonths,
      earning: earningBalances(held, month === 1 ? withdrawn : {}),
      accruedThisYear: accrued,
    });
    if (month === 1) {
      for (const account of ACCOUNTS) held[account] -= withdrawn[account] ?? 0;
    }
    accrued = step.accruedThisYear;
    base.push(step.baseAccrued);
    extraOn.push(step.extraAccruedOn);
    extraTo.push(step.extraAccruedTo);
    for (const paid of receipts) {
      if (paid.month === month) held = { ...held, [paid.account]: held[paid.account] + paid.amount };
    }
  }
  return {
    credited: creditInterest(accrued),
    monthlyBase: base,
    base: sumMonths(base),
    extraOn: sumMonths(extraOn),
    extraTo: sumMonths(extraTo),
  };
}

/** The 2026 rule set with some interest rules changed, to show they come from the rule set. */
const withInterest = (changes: Partial<RuleSet['interest']>): RuleSet => ({
  ...CURRENT_RULE_SET,
  interest: { ...CURRENT_RULE_SET.interest, ...changes },
});

/** A rule set with no extra interest at all, to isolate base interest. */
const BASE_ONLY = withInterest({ extraTiersBelow55: [], extraTiersFrom55: [] });

/* Base interest ------------------------------------------------------------ */

describe('base interest: derived fixtures', () => {
  it.each(BASE_INTEREST_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s matches exactly',
    (_id, fixture) => {
      const { base } = runYear(CURRENT_RULE_SET, balances(fixture.openingBalances), {
        ageInMonths: fixture.age * 12,
        receipts: fixture.contributions,
      });
      for (const account of ACCOUNTS) {
        expect(base[account], account).toBe(fixture.expected[account] ?? 0);
      }
    },
  );

  it('covers every fixture', () => {
    expect(BASE_INTEREST_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('base interest: computation', () => {
  it('earns a twelfth of each account’s annual rate a month', () => {
    const { baseAccrued } = accrueInterest({
      rules: CURRENT_RULE_SET,
      ageInMonths: AGE_40,
      earning: balances({ ordinary: 4_800_000, special: 3_000_000, medisave: 3_000_000, retirement: 3_000_000 }),
      accruedThisYear: NOTHING_ACCRUED,
    });
    // $48,000 x 2.5% / 12 = $100; $30,000 x 4% / 12 = $100.
    expect(baseAccrued).toEqual({ ordinary: 10_000, special: 10_000, medisave: 10_000, retirement: 10_000 });
  });

  it('reads every rate from the rule set it is given', () => {
    const rules = withInterest({ ordinary: 0.03, special: 0.05, medisave: 0.06, retirement: 0.012 });
    const { baseAccrued } = accrueInterest({
      rules,
      ageInMonths: AGE_40,
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
    const { monthlyBase } = runYear(CURRENT_RULE_SET, balances(), {
      receipts: [{ month: 3, account: 'special', amount: 3_000_000 }],
    });
    expect(monthlyBase.slice(0, 3).map((month) => month.special)).toEqual([0, 0, 0]);
    expect(monthlyBase[3]?.special).toBe(10_000);
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
    const { credited, base } = runYear(BASE_ONLY, balances({ ordinary: 192 }));
    expect(credited.ordinary).toBe(5);
    // The months still add up to exactly what is credited.
    expect(base.ordinary).toBe(credited.ordinary);
  });

  it('rounds half a cent up', () => {
    // 20c in OA earns exactly half a cent for the year: rounds up to 1c.
    expect(runYear(BASE_ONLY, balances({ ordinary: 20 })).credited.ordinary).toBe(1);
    // 16c earns 0.4c: rounds down to nothing.
    expect(runYear(BASE_ONLY, balances({ ordinary: 16 })).credited.ordinary).toBe(0);
  });

  it('does not compound within the year', () => {
    // Twelve months of $100 on $48,000 OA, not interest on interest.
    const { credited } = runYear(BASE_ONLY, balances({ ordinary: 4_800_000 }));
    expect(credited.ordinary).toBe(120_000);
  });

  it('credits each account its base interest plus the extra interest routed to it', () => {
    const year = runYear(
      CURRENT_RULE_SET,
      balances({ ordinary: 3_000_000, special: 1_000_000, medisave: 500_000 }),
    );
    for (const account of ACCOUNTS) {
      expect(year.credited[account], account).toBe(year.base[account] + year.extraTo[account]);
    }
  });
});

/* Extra interest ----------------------------------------------------------- */

describe('extra interest: derived fixtures', () => {
  it.each(EXTRA_INTEREST_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s matches exactly',
    (_id, fixture) => {
      const ageInMonths = fixture.age * 12;
      const held = balances(fixture.balances);
      const { counted } = countForExtraInterest(CURRENT_RULE_SET, ageInMonths, held);
      // The fixtures state a year's extra interest on unchanging balances.
      const year = runYear(CURRENT_RULE_SET, held, { ageInMonths });
      for (const account of ACCOUNTS) {
        expect(counted[account], `counted: ${account}`).toBe(fixture.expectedCounted[account] ?? 0);
        expect(year.extraOn[account], `earned on: ${account}`).toBe(fixture.expectedEarnedOn[account] ?? 0);
        expect(year.extraTo[account], `credited to: ${account}`).toBe(fixture.expectedCreditedTo[account] ?? 0);
      }
    },
  );

  it('covers every fixture', () => {
    expect(EXTRA_INTEREST_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('extra interest: tiers and counting order', () => {
  it('counts no more than $20,000 of the Ordinary Account', () => {
    const { counted } = countForExtraInterest(CURRENT_RULE_SET, AGE_40, balances({ ordinary: 10_000_000 }));
    expect(counted).toEqual(balances({ ordinary: 2_000_000 }));
  });

  it('stops counting once the $60,000 of combined balances is filled', () => {
    const { counted } = countForExtraInterest(
      CURRENT_RULE_SET,
      AGE_40,
      balances({ ordinary: 2_000_000, special: 3_000_000, medisave: 3_000_000 }),
    );
    // OA $20,000 and SA $30,000 come first; MA fills the last $10,000.
    expect(counted).toEqual(balances({ ordinary: 2_000_000, special: 3_000_000, medisave: 1_000_000 }));
    expect(totalOf(counted)).toBe(6_000_000);
  });

  it('counts in the rule set’s order, whatever it is', () => {
    const held = balances({ ordinary: 2_000_000, special: 3_000_000, medisave: 3_000_000 });
    const reordered = withInterest({ extraInterestCountingOrder: ['medisave', 'special', 'ordinary', 'retirement'] });
    const { counted } = countForExtraInterest(reordered, AGE_40, held);
    // MA $30,000, then SA $30,000, and the tier is full before OA is reached.
    expect(counted).toEqual(balances({ medisave: 3_000_000, special: 3_000_000 }));
  });

  it('reads the tiers and the OA cap from the rule set', () => {
    const rules = withInterest({
      extraTiersBelow55: [{ amount: 10_000, rate: 0.03 }],
      ordinaryAccountExtraInterestCap: 5_000,
    });
    const year = runYear(rules, balances({ ordinary: 2_000_000, special: 2_000_000 }));
    // OA counts $5,000, SA the remaining $5,000; 3% of each is $150.
    expect(year.extraOn).toEqual(balances({ ordinary: 15_000, special: 15_000 }));
  });

  it('switches to the from-55 tiers the month after the 55th birthday month', () => {
    const held = balances({ retirement: 3_000_000 });
    const birthdayMonth = runYear(CURRENT_RULE_SET, held, { ageInMonths: 55 * 12 });
    const monthAfter = runYear(CURRENT_RULE_SET, held, { ageInMonths: 55 * 12 + 1 });
    // $30,000 at 1%, then at 2%.
    expect(birthdayMonth.extraOn.retirement).toBe(30_000);
    expect(monthAfter.extraOn.retirement).toBe(60_000);
  });
});

describe('extra interest: routing', () => {
  it('credits extra interest on the Ordinary Account to the Special Account below 55', () => {
    expect(extraInterestDestination(CURRENT_RULE_SET, AGE_40, 'ordinary')).toBe('special');
    const year = runYear(CURRENT_RULE_SET, balances({ ordinary: 2_000_000 }));
    expect(year.extraOn.ordinary).toBe(20_000);
    expect(year.extraTo).toEqual(balances({ special: 20_000 }));
    // The OA itself is credited only its own base interest.
    expect(year.credited.ordinary).toBe(year.base.ordinary);
  });

  it('credits it to the Retirement Account from 55', () => {
    expect(extraInterestDestination(CURRENT_RULE_SET, AGE_60, 'ordinary')).toBe('retirement');
    expect(extraInterestDestination(CURRENT_RULE_SET, 55 * 12, 'ordinary')).toBe('special');
    expect(extraInterestDestination(CURRENT_RULE_SET, 55 * 12 + 1, 'ordinary')).toBe('retirement');
  });

  it('leaves extra interest on every other account where it was earned', () => {
    for (const account of ['special', 'medisave', 'retirement'] as const) {
      expect(extraInterestDestination(CURRENT_RULE_SET, AGE_40, account)).toBe(account);
      expect(extraInterestDestination(CURRENT_RULE_SET, AGE_60, account)).toBe(account);
    }
  });

  it('routes without creating or losing any extra interest', () => {
    for (const ageInMonths of [AGE_40, AGE_60]) {
      const year = runYear(
        CURRENT_RULE_SET,
        balances({ ordinary: 2_500_000, special: 1_000_000, medisave: 1_500_000, retirement: 1_000_000 }),
        { ageInMonths },
      );
      expect(totalOf(year.extraTo)).toBe(totalOf(year.extraOn));
      expect(year.extraTo.ordinary).toBe(0);
    }
  });
});

describe('extra interest: drawing the Ordinary Account below $20,000', () => {
  // OA $30,000, SA $10,000, MA $5,000: combined $45,000, all of it under the
  // $60,000 tier except the $10,000 of OA above its cap.
  const held = balances({ ordinary: 3_000_000, special: 1_000_000, medisave: 500_000 });
  const extraFor = (withdrawn: Partial<AccountAmounts>) =>
    totalOf(runYear(CURRENT_RULE_SET, held, { withdrawn }).extraOn);

  it('costs nothing in extra interest while the OA stays at or above $20,000', () => {
    const untouched = extraFor({});
    expect(untouched).toBe(35_000);
    // $10,000 drawn leaves exactly $20,000: the tier counts the same.
    expect(extraFor({ ordinary: 1_000_000 })).toBe(untouched);
  });

  it('forfeits 1% a year on every dollar drawn below $20,000', () => {
    // $25,000 drawn leaves $5,000: $15,000 of the tier is gone, a $150 a year loss.
    expect(extraFor({ ordinary: 2_500_000 })).toBe(35_000 - 15_000);
    // Drawn to zero: the whole $20,000 is gone, $200 a year.
    expect(extraFor({ ordinary: 3_000_000 })).toBe(35_000 - 20_000);
  });

  it('loses nothing when other savings refill the tier the OA leaves', () => {
    // With SA holding $50,000, the tier is full with or without the OA, so
    // drawing the OA down moves extra interest between accounts but does not
    // reduce it.
    const saRich = balances({ ordinary: 2_000_000, special: 5_000_000 });
    const before = runYear(CURRENT_RULE_SET, saRich).extraOn;
    const after = runYear(CURRENT_RULE_SET, saRich, { withdrawn: { ordinary: 1_000_000 } }).extraOn;
    expect(totalOf(before)).toBe(60_000);
    expect(totalOf(after)).toBe(60_000);
    expect(after.ordinary).toBeLessThan(before.ordinary);
  });
});
