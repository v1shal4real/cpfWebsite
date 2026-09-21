import type { HousingAccruedInterestFixture, RuleQuote } from './types';

/*
 * Derived, not transcribed. See the note in `types.ts`.
 */

const ACCRUED: RuleQuote = {
  cite: { sourceId: 'housingAccruedInterest', locator: 'What accrued interest is' },
  quote:
    'Accrued interest is the interest your CPF savings would have earned if they had remained in your account. It uses CPF’s prevailing interest rates, compounded annually throughout this period.',
};

const RATE: RuleQuote = {
  cite: { sourceId: 'interestRates', locator: 'CPF interest rates' },
  quote: 'Ordinary Account 2.5% per annum.',
};

const WHOLE_YEARS =
  'Each withdrawal is taken at the start of a projection year, so interest accrues over whole years and the monthly computation never splits a year.';

const FLAT_RATE =
  'The Ordinary Account rate holds at 2.5% for the whole period, as it does in the 2026 rule set. A projection crossing a rate change resolves the rate per year instead.';

export const HOUSING_ACCRUED_INTEREST_FIXTURES: readonly HousingAccruedInterestFixture[] = [
  {
    derived: true,
    id: 'accrued-interest-single-withdrawal-two-years',
    description: '$100,000 used for a property, held for two years',
    rules: [ACCRUED, RATE],
    assumptions: [WHOLE_YEARS, FLAT_RATE],
    workings: [
      'Year 1: $100,000 x 1.025 = $102,500.',
      'Year 2: $102,500 x 1.025 = $105,062.50.',
      'Accrued interest: $105,062.50 - $100,000 = $5,062.50.',
    ],
    withdrawals: [{ year: 1, amount: 10_000_000 }],
    years: 2,
    expected: { principal: 10_000_000, accruedInterest: 506_250, refundable: 10_506_250 },
  },
  {
    derived: true,
    id: 'accrued-interest-second-withdrawal-compounds-on-the-total',
    description: 'A further $50,000 drawn a year later, so interest compounds on the cumulative principal',
    rules: [ACCRUED, RATE],
    assumptions: [WHOLE_YEARS, FLAT_RATE],
    workings: [
      'Year 1: $100,000 x 1.025 = $102,500.',
      'Start of year 2: a further $50,000 is drawn, giving $152,500.',
      'Year 2: $152,500 x 1.025 = $156,312.50.',
      'Accrued interest: $156,312.50 - $150,000 = $6,312.50.',
    ],
    withdrawals: [
      { year: 1, amount: 10_000_000 },
      { year: 2, amount: 5_000_000 },
    ],
    years: 2,
    expected: { principal: 15_000_000, accruedInterest: 631_250, refundable: 15_631_250 },
  },
];
