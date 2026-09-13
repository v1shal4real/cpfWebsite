import type { RuleSet } from './types';

/**
 * CPF rules in force from 1 January 2026.
 *
 * Transcribed from the build specification. UNVERIFIED against the primary
 * sources — `verified` is `false` and the interface says so until each figure
 * has been re-checked on the page named in its `sourceId`.
 *
 * Two gaps are deliberate and marked TODO rather than guessed at, because a
 * plausible-looking wrong number is worse here than an obvious hole:
 *
 *   - Contribution rates above age 55 step down across four further bands. The
 *     spec only states the 55-and-below band, so only that band is encoded.
 *     The engine must refuse to project past 55 until the rest are filled in.
 *   - The Basic Healthcare Sum is revised annually for members below 65 and the
 *     retirement sums rise for each cohort. A single figure is correct only for
 *     the 2026 cohort; projecting a 30-year-old to 55 needs the escalation
 *     series, which belongs in its own dated sets (spec section 4.1).
 */
export const RULE_SET_2026: RuleSet = {
  id: 'sg-cpf-2026-01',
  label: '1 January 2026',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  verified: false,

  wageCeilings: {
    sourceId: 'contributionRates',
    ordinaryWageCeiling: 8_000,
    annualSalaryCeiling: 102_000,
    annualLimit: 37_740,
  },

  contributionRates: {
    sourceId: 'contributionRates',
    bands: [
      // TODO(verify): bands above 55 are not stated in the spec. Fill from the
      // primary source before the engine is allowed to project past age 55.
      { throughAge: 55, employee: 0.2, employer: 0.17 },
    ],
  },

  allocation: {
    sourceId: 'allocationRates',
    // Ratios of the total contribution. MediSave is computed first, then
    // Special or Retirement; the remainder falls to Ordinary. The `ordinary`
    // figure is recorded for display and cross-checking, not for the engine to
    // multiply by directly.
    bands: [
      { throughAge: 35, ordinary: 0.6217, specialOrRetirement: 0.1621, medisave: 0.2162 },
      { throughAge: 45, ordinary: 0.5677, specialOrRetirement: 0.1891, medisave: 0.2432 },
      { throughAge: 50, ordinary: 0.5136, specialOrRetirement: 0.2162, medisave: 0.2702 },
      { throughAge: 55, ordinary: 0.4055, specialOrRetirement: 0.3108, medisave: 0.2837 },
      { throughAge: 60, ordinary: 0.353, specialOrRetirement: 0.3382, medisave: 0.3088 },
      { throughAge: 65, ordinary: 0.14, specialOrRetirement: 0.44, medisave: 0.42 },
      { throughAge: 70, ordinary: 0.0607, specialOrRetirement: 0.303, medisave: 0.6363 },
      { throughAge: null, ordinary: 0.08, specialOrRetirement: 0.08, medisave: 0.84 },
    ],
  },

  interest: {
    sourceId: 'interestRates',
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
    // No more than $20,000 of the tier may be drawn from the Ordinary Account.
    // This sub-cap is the mechanism the whole product exists to make visible.
    ordinaryAccountExtraInterestCap: 20_000,
    extraInterestOnOrdinaryCreditedTo: 'special-or-retirement',
  },

  thresholds: {
    sourceId: 'retirementSums',
    // TODO(verify): BHS comes from the Ministry of Health announcement, not the
    // retirement sums page. Split the sourceId when the figures are checked.
    basicHealthcareSum: 79_000,
    basicRetirementSum: 110_200,
    fullRetirementSum: 220_400,
    enhancedRetirementSum: 440_800,
  },

  housing: {
    sourceId: 'housing',
    accruedInterestRate: 0.025,
    hdbLoanRetentionCap: 20_000,
    concessionaryLoanRate: 0.026,
  },
};
