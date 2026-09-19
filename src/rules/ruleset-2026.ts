import type { RuleSet } from './types';

/**
 * CPF rules in force from 1 January 2026.
 *
 * Verified on 14 September 2026: every figure below was read off the page its
 * source names and matched. No figure needed correcting. The rates stated for
 * 1 January 2026 were still in force for the quarter to 30 September 2026.
 *
 * Contribution rates for every age band were read off their source page on
 * 19 September 2026.
 *
 * Verified means correct, not complete. One gap remains, deliberately marked
 * TODO rather than filled from anywhere but a primary source:
 *
 *   - Escalation. The Basic Healthcare Sum is revised annually for members
 *     below 65 and the retirement sums rise for each cohort, so these figures
 *     are correct for 2026 only. Projecting a 30-year-old to 55 needs the
 *     escalation series, which belongs in its own dated data.
 */
export const RULE_SET_2026: RuleSet = {
  id: 'sg-cpf-2026-01',
  label: '1 January 2026',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  verified: true,

  wageCeilings: {
    // The OW ceiling page states both the $8,000 monthly ceiling and the
    // $102,000 annual salary ceiling; the Annual Limit is on its own page.
    sourceId: 'ordinaryWageCeiling',
    fieldSources: { annualLimit: 'annualLimit' },
    ordinaryWageCeiling: 8_000,
    annualSalaryCeiling: 102_000,
    annualLimit: 37_740,
  },

  contributionRates: {
    sourceId: 'contributionRates',
    // For monthly wages above $750, for Singapore Citizens and for SPRs from
    // their third year. Each band's total matches the denominator of its
    // allocation ratios below.
    bands: [
      { throughAge: 55, employee: 0.2, employer: 0.17 },
      { throughAge: 60, employee: 0.18, employer: 0.16 },
      { throughAge: 65, employee: 0.125, employer: 0.125 },
      { throughAge: 70, employee: 0.075, employer: 0.09 },
      { throughAge: null, employee: 0.05, employer: 0.075 },
    ],
  },

  allocation: {
    sourceId: 'allocationRates',
    // Ratios of the total contribution, exactly as published. MediSave is
    // computed first, then Special or Retirement; the remainder falls to
    // Ordinary. The `ordinary` figure is recorded for display and
    // cross-checking, not for the engine to multiply by directly.
    bands: [
      { throughAge: 35, ordinary: 0.6217, specialOrRetirement: 0.1621, medisave: 0.2162 },
      { throughAge: 45, ordinary: 0.5677, specialOrRetirement: 0.1891, medisave: 0.2432 },
      { throughAge: 50, ordinary: 0.5136, specialOrRetirement: 0.2162, medisave: 0.2702 },
      { throughAge: 55, ordinary: 0.4055, specialOrRetirement: 0.3108, medisave: 0.2837 },
      // From 55 the second column is the Retirement Account, up to the Full
      // Retirement Sum; above it, that share goes to the Ordinary Account.
      { throughAge: 60, ordinary: 0.353, specialOrRetirement: 0.3382, medisave: 0.3088 },
      { throughAge: 65, ordinary: 0.14, specialOrRetirement: 0.44, medisave: 0.42 },
      { throughAge: 70, ordinary: 0.0607, specialOrRetirement: 0.303, medisave: 0.6363 },
      { throughAge: null, ordinary: 0.08, specialOrRetirement: 0.08, medisave: 0.84 },
    ],
  },

  interest: {
    sourceId: 'interestRates',
    // Floors. The 4% floor on Special, MediSave and Retirement monies runs to
    // 31 December 2026 and is extended by decision, not by default.
    ordinary: 0.025,
    special: 0.04,
    medisave: 0.04,
    retirement: 0.04,
    // Below 55: 1% on the first $60,000 of combined balances.
    extraTiersBelow55: [{ amount: 60_000, rate: 0.01 }],
    // From 55: 2% on the first $30,000, then 1% on the next $30,000.
    extraTiersFrom55: [
      { amount: 30_000, rate: 0.02 },
      { amount: 30_000, rate: 0.01 },
    ],
    // No more than $20,000 of the tier may be drawn from the Ordinary Account,
    // at any age. This sub-cap is the mechanism the product exists to show.
    ordinaryAccountExtraInterestCap: 20_000,
    extraInterestOnOrdinaryCreditedTo: 'special-or-retirement',
    // For the engine (see the `interestComputation` source): interest is
    // computed monthly, then credited and compounded annually. Money received
    // in a month starts earning from the next month; money withdrawn stops
    // earning from the month it leaves.
  },

  thresholds: {
    sourceId: 'fullRetirementSum',
    fieldSources: {
      basicHealthcareSum: 'newsRelease2026Q1',
      basicRetirementSum: 'basicRetirementSum',
      enhancedRetirementSum: 'enhancedRetirementSum',
    },
    basicHealthcareSum: 79_000,
    basicRetirementSum: 110_200,
    fullRetirementSum: 220_400,
    enhancedRetirementSum: 440_800,
  },

  housing: {
    sourceId: 'housingAccruedInterest',
    fieldSources: {
      hdbLoanRetentionCap: 'housingLoanRetention',
      concessionaryLoanRate: 'newsRelease2026Q1',
    },
    // The prevailing Ordinary Account rate, compounded annually.
    accruedInterestRate: 0.025,
    // Bank-loan buyers may retain any amount, so only the HDB cap is a rule.
    hdbLoanRetentionCap: 20_000,
    concessionaryLoanRate: 0.026,
  },
};
