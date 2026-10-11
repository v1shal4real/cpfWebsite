import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';
import { HOUSING_ACCRUED_INTEREST_FIXTURES } from './__fixtures__';
import { NO_HOUSING_USE, accrueHousingInterest, type AccruedInterestMonth } from './accruedInterest';

/** The 2026 rule set with a different accrued interest rate. */
const withRate = (accruedInterestRate: number): RuleSet => ({
  ...CURRENT_RULE_SET,
  housing: { ...CURRENT_RULE_SET.housing, accruedInterestRate },
});

/**
 * Runs whole calendar years from January, withdrawing each amount in the
 * January of its year (year 1 = the first), as the fixtures assume.
 */
function runYears(
  years: number,
  withdrawals: readonly { year: number; month?: number; amount: number }[],
  rules: RuleSet = CURRENT_RULE_SET,
) {
  let state = { ...NO_HOUSING_USE };
  const months: AccruedInterestMonth[] = [];
  for (let year = 1; year <= years; year++) {
    for (let calendarMonth = 1; calendarMonth <= 12; calendarMonth++) {
      const withdrawn = withdrawals
        .filter((each) => each.year === year && (each.month ?? 1) === calendarMonth)
        .reduce((sum, each) => sum + each.amount, 0);
      const month = accrueHousingInterest({ rules, state, withdrawn, calendarMonth });
      state = month.state;
      months.push(month);
    }
  }
  return { months, last: months.at(-1)! };
}

describe('derived fixtures', () => {
  it.each(HOUSING_ACCRUED_INTEREST_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s matches exactly',
    (_id, fixture) => {
      const { last } = runYears(fixture.years, fixture.withdrawals);
      expect(last.principalUsed).toBe(fixture.expected.principal);
      expect(last.accruedInterest).toBe(fixture.expected.accruedInterest);
      expect(last.refundable).toBe(fixture.expected.refundable);
    },
  );

  it('covers every fixture', () => {
    expect(HOUSING_ACCRUED_INTEREST_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('accrual', () => {
  it('compounds annually on the cumulative principal', () => {
    // $100,000 for three years at 2.5%: 100,000 x 1.025^3 = $107,689.06.
    const { months, last } = runYears(3, [{ year: 1, amount: 10_000_000 }]);
    expect(last.accruedInterest).toBe(768_906);
    // Year by year: $2,500, then $2,562.50, then $2,626.56.
    expect(months[11]!.accruedInterest).toBe(250_000);
    expect(months[23]!.accruedInterest - months[11]!.accruedInterest).toBe(256_250);
  });

  it('does not compound within the year', () => {
    // $100,000 from January: $208.33 a month, the same every month of the year.
    const { months } = runYears(1, [{ year: 1, amount: 10_000_000 }]);
    const monthly = months.map((month, index) => month.accruedInterest - (months[index - 1]?.accruedInterest ?? 0));
    for (const amount of monthly) expect(Math.abs(amount - 20_833.33)).toBeLessThanOrEqual(1);
  });

  it('accrues on a withdrawal from the month it is made', () => {
    // $120,000 withdrawn in July: six months of 2.5% / 12, or $1,500 by December.
    const { months } = runYears(1, [{ year: 1, month: 7, amount: 12_000_000 }]);
    expect(months[5]!.accruedInterest).toBe(0);
    expect(months[6]!.accruedInterest).toBe(25_000);
    expect(months[11]!.accruedInterest).toBe(150_000);
  });

  it('counts the year so far in the refund due, not only the years credited', () => {
    const { months } = runYears(2, [{ year: 1, amount: 12_000_000 }]);
    // March of year two: $3,000 credited for year one, plus three months on $123,000.
    const march = months[14]!;
    expect(march.accruedInterest).toBe(300_000 + 76_875);
    expect(march.refundable).toBe(12_000_000 + 376_875);
  });

  it('keeps accruing with no further withdrawals, as after the loan is repaid', () => {
    const { months } = runYears(10, [{ year: 1, amount: 10_000_000 }]);
    for (let index = 1; index < months.length; index++) {
      expect(months[index]!.accruedInterest).toBeGreaterThan(months[index - 1]!.accruedInterest);
      expect(months[index]!.principalUsed).toBe(10_000_000);
    }
  });

  it('reads the rate from the rule set’s housing.accruedInterestRate', () => {
    const { last } = runYears(1, [{ year: 1, amount: 10_000_000 }], withRate(0.03));
    expect(last.accruedInterest).toBe(300_000);
    const { last: none } = runYears(1, [{ year: 1, amount: 10_000_000 }], withRate(0));
    expect(none.accruedInterest).toBe(0);
  });

  it('owes nothing before any CPF is used', () => {
    const { last } = runYears(2, []);
    expect(last).toMatchObject({ principalUsed: 0, accruedInterest: 0, refundable: 0 });
  });
});
