import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';
import { drawLoan, levelInstalment, loanRate, repayLoan, type LoanMonth } from './loan';
import type { LoanTerms, MonthlyLoan } from './types';

const hdb = (principal: number, tenureYears: number): LoanTerms => ({
  kind: 'hdb-concessionary',
  principal,
  tenureYears,
});

const bank = (principal: number, tenureYears: number, interestRate: number): LoanTerms => ({
  kind: 'bank',
  principal,
  tenureYears,
  interestRate,
});

/** The 2026 rule set with a different Ordinary Account rate. */
const withOrdinaryRate = (ordinary: number): RuleSet => ({
  ...CURRENT_RULE_SET,
  interest: { ...CURRENT_RULE_SET.interest, ordinary },
});

/**
 * Draws a loan and repays it until cleared, taking the rules for each
 * repayment month from `rulesFor` (by instalment number, 1 = first).
 */
function runLoan(terms: LoanTerms, rulesFor: (instalment: number) => RuleSet = () => CURRENT_RULE_SET) {
  const months: LoanMonth[] = [drawLoan(terms, rulesFor(0))];
  while (!months.at(-1)!.cleared && months.length < 1_000) {
    months.push(repayLoan(months.at(-1)!.state, rulesFor(months.length)));
  }
  const repayments: MonthlyLoan[] = months.slice(1).map((month) => month.record);
  return { months, draw: months[0]!.record, repayments, last: months.at(-1)! };
}

describe('rate', () => {
  it('derives the HDB rate from the Ordinary Account rate plus the peg', () => {
    expect(loanRate(hdb(1, 1), CURRENT_RULE_SET)).toBeCloseTo(0.026, 10);
    // It moves with the OA rate, not with a stored figure.
    expect(loanRate(hdb(1, 1), withOrdinaryRate(0.03))).toBeCloseTo(0.031, 10);
  });

  it('agrees with the published HDB rate for the rule set', () => {
    expect(loanRate(hdb(1, 1), CURRENT_RULE_SET)).toBeCloseTo(CURRENT_RULE_SET.housing.concessionaryLoanRate, 10);
  });

  it('uses a bank loan’s own rate, whatever the rules', () => {
    expect(loanRate(bank(1, 1, 0.0325), CURRENT_RULE_SET)).toBe(0.0325);
    expect(loanRate(bank(1, 1, 0.0325), withOrdinaryRate(0.05))).toBe(0.0325);
  });
});

describe('level instalment', () => {
  it('matches the standard amortisation formula, rounded up to the cent', () => {
    // P x r / (1 - (1 + r)^-n): $400,000 at 2.6% over 25 years is $1,814.678.
    expect(levelInstalment(40_000_000, 0.026, 300)).toBe(181_468);
    // $500,000 on the same terms is $2,268.3475.
    expect(levelInstalment(50_000_000, 0.026, 300)).toBe(226_835);
    // $300,000 at 3% over 30 years is $1,264.812.
    expect(levelInstalment(30_000_000, 0.03, 360)).toBe(126_482);
  });

  it('shares the balance equally at a zero rate', () => {
    expect(levelInstalment(1_200_000, 0, 12)).toBe(100_000);
    expect(levelInstalment(1_000_000, 0, 3)).toBe(333_334);
  });
});

describe('amortisation', () => {
  const { draw, repayments, last } = runLoan(hdb(40_000_000, 25));

  it('draws the loan in the month of purchase, with nothing due until the next', () => {
    expect(draw).toMatchObject({ openingBalance: 0, drawn: 40_000_000, instalment: 0, closingBalance: 40_000_000 });
  });

  it('clears in exactly tenure x 12 monthly instalments', () => {
    expect(repayments).toHaveLength(300);
    expect(last.cleared).toBe(true);
    expect(last.record.closingBalance).toBe(0);
    expect(last.state.instalmentsPaid).toBe(300);
  });

  it('charges a month of the rate on the opening balance, to the nearest cent', () => {
    for (const month of repayments) {
      const exact = (month.openingBalance * 0.026) / 12;
      expect(Math.abs(month.interest - exact)).toBeLessThanOrEqual(0.5);
      expect(month.instalment).toBe(month.interest + month.principal);
      expect(month.closingBalance).toBe(month.openingBalance - month.principal);
    }
  });

  it('pays a level instalment, with the last clearing exactly what is left', () => {
    const level = repayments[0]!.instalment;
    expect(level).toBe(181_468);
    for (const month of repayments.slice(0, -1)) expect(month.instalment).toBe(level);
    expect(repayments.at(-1)!.instalment).toBeLessThanOrEqual(level);
  });

  it('repays exactly the principal, and totals the interest', () => {
    expect(repayments.reduce((sum, month) => sum + month.principal, 0)).toBe(40_000_000);
    expect(last.state.totalInterestPaid).toBe(repayments.reduce((sum, month) => sum + month.interest, 0));
    // Roughly $1,814.68 x 300 - $400,000.
    expect(last.state.totalInterestPaid).toBeGreaterThan(14_400_000);
    expect(last.state.totalInterestPaid).toBeLessThan(14_500_000);
  });

  it('never runs past the tenure, whatever the rounding', () => {
    for (const principal of [1, 99_999, 12_345_678, 50_000_000, 123_456_789]) {
      for (const tenureYears of [1, 5, 25, 30]) {
        for (const terms of [hdb(principal, tenureYears), bank(principal, tenureYears, 0.0419)]) {
          const { repayments: paid, last: final } = runLoan(terms);
          const label = `${principal} over ${tenureYears}`;
          // Rounding the instalment up can only finish early, and only for a
          // loan of a few cents, which cannot be split into that many payments.
          expect(paid.length, label).toBeLessThanOrEqual(tenureYears * 12);
          if (principal >= 99_999) expect(paid, label).toHaveLength(tenureYears * 12);
          expect(final.record.closingBalance).toBe(0);
          expect(paid.reduce((sum, month) => sum + month.principal, 0)).toBe(principal);
        }
      }
    }
  });
});

describe('rate changes', () => {
  it('recomputes the HDB instalment when the OA rate moves, and still clears on time', () => {
    // The OA rate rises from 2.5% to 3% after the first year.
    const { repayments, last } = runLoan(hdb(40_000_000, 25), (instalment) =>
      instalment <= 12 ? CURRENT_RULE_SET : withOrdinaryRate(0.03),
    );
    expect(repayments[11]!.rate).toBeCloseTo(0.026, 10);
    expect(repayments[12]!.rate).toBeCloseTo(0.031, 10);
    expect(repayments[12]!.instalment).toBeGreaterThan(repayments[11]!.instalment);
    // The new instalment clears the balance over the 288 months left.
    expect(repayments[12]!.instalment).toBe(levelInstalment(repayments[11]!.closingBalance, 0.031, 288));
    expect(repayments).toHaveLength(300);
    expect(last.record.closingBalance).toBe(0);
  });

  it('holds a bank loan’s instalment when the OA rate moves', () => {
    const { repayments } = runLoan(bank(40_000_000, 25, 0.03), (instalment) =>
      instalment <= 12 ? CURRENT_RULE_SET : withOrdinaryRate(0.04),
    );
    expect(repayments[12]!.instalment).toBe(repayments[11]!.instalment);
  });
});
