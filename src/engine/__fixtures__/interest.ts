import type { BaseInterestFixture, ExtraInterestFixture, RuleQuote } from './types';

/*
 * Derived, not transcribed. See the note in `types.ts`: CPF Board states these
 * rules but publishes no worked example of them.
 */

const COMPUTATION: RuleQuote = {
  cite: { sourceId: 'interestComputation', locator: 'How CPF interest is computed' },
  quote:
    'CPF interest is computed monthly. It is credited to your respective accounts by the following year and compounded annually.',
};

const TIMING: RuleQuote = {
  cite: { sourceId: 'interestComputation', locator: 'How CPF interest is computed' },
  quote: 'Contributions (including refunds) received this month start earning interest next month.',
};

const RATES: RuleQuote = {
  cite: { sourceId: 'interestRates', locator: 'CPF interest rates' },
  quote: 'Ordinary Account 2.5% per annum; Special, MediSave and Retirement Accounts 4% per annum.',
};

const EXTRA_BELOW_55: RuleQuote = {
  cite: { sourceId: 'extraInterest', locator: 'Members below 55' },
  quote:
    'If you are below 55 years old, you will earn an extra interest of 1% per annum on the first $60,000 of your combined CPF balances (capped at $20,000 for OA).',
};

const EXTRA_FROM_55: RuleQuote = {
  cite: { sourceId: 'extraInterest', locator: 'Members 55 and above' },
  quote:
    'If you are 55 years old and above, you will earn an extra interest of 2% per annum on the first $30,000 and 1% per annum on the next $30,000 of your combined CPF balances (capped at $20,000 for OA).',
};

/** The order accounts fill the tiers, which the `interestRates` page does not state. */
const COUNTING_ORDER: RuleQuote = {
  cite: { sourceId: 'extraInterest', locator: 'How is my combined CPF balance computed?' },
  quote:
    'Your accounts are used to compute your combined CPF balances in the following order: 1st: Retirement Account (RA), including any CPF LIFE premium balance; 2nd: OA, with a cap of $20,000; 3rd: Special Account (SA); 4th: MediSave Account (MA).',
};

const ROUTING_BELOW_55: RuleQuote = {
  cite: { sourceId: 'extraInterest', locator: 'Members below 55' },
  quote:
    'The extra interest earned on your Special Account (SA) and MediSave Account (MA) balances will go to the respective accounts, while the extra interest earned on your OA balances will go into your SA to enhance your retirement savings.',
};

const ROUTING_FROM_55: RuleQuote = {
  cite: { sourceId: 'extraInterest', locator: 'Members 55 and above' },
  quote:
    'The extra interest earned on your Retirement Account (RA) and MA balances will go to the respective accounts, while the extra interest earned on your OA balances will go into your RA to enhance your retirement savings.',
};

/** Balances that make every monthly figure exact, so no rounding rule is assumed. */
const EXACT_BALANCES =
  'Balances are chosen so that each month’s interest is a whole number of cents, because CPF Board does not publish how it rounds within a month.';

export const BASE_INTEREST_FIXTURES: readonly BaseInterestFixture[] = [
  {
    derived: true,
    id: 'base-interest-untouched-balances',
    description: 'A year with no transactions, below 55',
    rules: [COMPUTATION, RATES],
    assumptions: [
      EXACT_BALANCES,
      'Extra interest is excluded: this fixture covers base interest only, and the engine adds the two separately.',
    ],
    workings: [
      'OA: $48,000 x 2.5% = $1,200 a year, or $100 a month for 12 months.',
      'SA: $30,000 x 4% = $1,200 a year, or $100 a month for 12 months.',
      'MA: $30,000 x 4% = $1,200 a year, or $100 a month for 12 months.',
    ],
    age: 40,
    openingBalances: { ordinary: 4_800_000, special: 3_000_000, medisave: 3_000_000 },
    expected: { ordinary: 120_000, special: 120_000, medisave: 120_000 },
  },
  {
    derived: true,
    id: 'base-interest-contribution-earns-from-next-month',
    description: 'A contribution received in January earns interest from February, below 55',
    rules: [COMPUTATION, TIMING, RATES],
    assumptions: [
      EXACT_BALANCES,
      'The contribution is received within January, so it earns for the eleven months from February to December.',
      'Extra interest is excluded, as above.',
    ],
    workings: [
      'Opening OA: $48,000 x 2.5% = $100 a month for 12 months = $1,200.',
      'Contribution of $48,000 received in January earns from February: $100 a month for 11 months = $1,100.',
      'Total OA interest for the year: $1,200 + $1,100 = $2,300.',
    ],
    age: 40,
    openingBalances: { ordinary: 4_800_000 },
    contributions: [{ month: 1, account: 'ordinary', amount: 4_800_000 }],
    expected: { ordinary: 230_000 },
  },
];

export const EXTRA_INTEREST_FIXTURES: readonly ExtraInterestFixture[] = [
  {
    derived: true,
    id: 'extra-interest-below-55-oa-capped-at-20000',
    description: 'Below 55, OA above the sub-cap, combined balances above $60,000',
    rules: [EXTRA_BELOW_55, COUNTING_ORDER, ROUTING_BELOW_55],
    assumptions: [
      'The tier is filled in the published counting order, so each account earns extra interest on the part of itself that was counted.',
    ],
    workings: [
      'Counted: OA $20,000 of $50,000 (the sub-cap), then SA $40,000, reaching $60,000. MA counts nothing.',
      'Extra on OA: $20,000 x 1% = $200, credited to SA.',
      'Extra on SA: $40,000 x 1% = $400, credited to SA.',
      'SA receives $600 in total; MA receives nothing.',
    ],
    age: 40,
    balances: { ordinary: 5_000_000, special: 4_000_000, medisave: 2_000_000 },
    expectedCounted: { ordinary: 2_000_000, special: 4_000_000, medisave: 0 },
    expectedEarnedOn: { ordinary: 20_000, special: 40_000, medisave: 0 },
    expectedCreditedTo: { special: 60_000 },
  },
  {
    derived: true,
    id: 'extra-interest-below-55-sub-cap-reduces-the-tier',
    description: 'Below 55, a large OA leaves the $60,000 tier unfilled because of the $20,000 sub-cap',
    rules: [EXTRA_BELOW_55, COUNTING_ORDER, ROUTING_BELOW_55],
    assumptions: [
      'As above. This is the case the spec calls the product’s reason to exist: combined balances are $45,000 but only $35,000 earns extra interest.',
    ],
    workings: [
      'Counted: OA $20,000 of $30,000 (the sub-cap), SA $10,000, MA $5,000, totalling $35,000 of the $60,000 tier.',
      'Extra on OA: $20,000 x 1% = $200, credited to SA.',
      'Extra on SA: $10,000 x 1% = $100, credited to SA.',
      'Extra on MA: $5,000 x 1% = $50, credited to MA.',
      'Without the sub-cap the full $45,000 would count, earning $450 instead of $350.',
    ],
    age: 40,
    balances: { ordinary: 3_000_000, special: 1_000_000, medisave: 500_000 },
    expectedCounted: { ordinary: 2_000_000, special: 1_000_000, medisave: 500_000 },
    expectedEarnedOn: { ordinary: 20_000, special: 10_000, medisave: 5_000 },
    expectedCreditedTo: { special: 30_000, medisave: 5_000 },
  },
  {
    derived: true,
    id: 'extra-interest-from-55-across-both-tiers',
    description: 'From 55, an account spanning the 2% and 1% tiers',
    rules: [EXTRA_FROM_55, COUNTING_ORDER, ROUTING_FROM_55],
    assumptions: [
      'The Special Account is closed at 55, so there is none to count.',
      'The tiers are filled in the counting order, so the OA straddles them: $10,000 falls in the 2% tier and $10,000 in the 1% tier.',
    ],
    workings: [
      'Counted: RA $20,000, then OA $20,000 of $30,000 (the sub-cap), then MA $15,000, totalling $55,000.',
      'The 2% tier takes the first $30,000: RA $20,000 and $10,000 of the OA.',
      'The 1% tier takes the next $25,000: the remaining $10,000 of the OA and MA $15,000.',
      'Extra on RA: $20,000 x 2% = $400, credited to RA.',
      'Extra on OA: ($10,000 x 2%) + ($10,000 x 1%) = $300, credited to RA.',
      'Extra on MA: $15,000 x 1% = $150, credited to MA.',
      'RA receives $700 and MA $150, totalling $850.',
    ],
    age: 60,
    balances: { ordinary: 3_000_000, medisave: 1_500_000, retirement: 2_000_000 },
    expectedCounted: { ordinary: 2_000_000, medisave: 1_500_000, retirement: 2_000_000 },
    expectedEarnedOn: { ordinary: 30_000, medisave: 15_000, retirement: 40_000 },
    expectedCreditedTo: { medisave: 15_000, retirement: 70_000 },
  },
];
