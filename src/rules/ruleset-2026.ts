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
 * Escalation series for the Basic Retirement Sum and the Basic Healthcare Sum
 * were read off their source pages on 1 October 2026. The rates assumed beyond
 * the last published year were decided on that date and are assumptions, not
 * CPF Board figures; `escalation` says so in its own words.
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
    // The summary page states the rates; the rate table states the wage
    // brackets they apply to.
    fieldSources: { fullRatesFromMonthlyWage: 'contributionRateTable2026' },
    fullRatesFromMonthlyWage: 750,
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
    // The counting order is stated only on the extra-interest page.
    fieldSources: { extraInterestCountingOrder: 'extraInterest' },
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
    // RA first (including any CPF LIFE premium balance), then OA up to its
    // cap, then SA, then MA.
    extraInterestCountingOrder: ['retirement', 'ordinary', 'special', 'medisave'],
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
      medisaveOverflowTo: 'medisaveOverflow',
    },
    basicHealthcareSum: 79_000,
    medisaveOverflowTo: 'special-or-retirement-until-full-retirement-sum-then-ordinary',
    basicRetirementSum: 110_200,
    fullRetirementSum: 220_400,
    enhancedRetirementSum: 440_800,
  },

  escalation: {
    sourceId: 'basicRetirementSum',
    fieldSources: { basicHealthcareSum: 'basicHealthcareSum' },
    basicRetirementSum: {
      // By the year a cohort turns 55, as published. The 2015 figure applies
      // from 1 July 2015. CPF Board raised the BRS 3.5% a year for the cohorts
      // from 2023 to 2027, rounding to the nearest $100, and has published
      // the 2027 figure.
      published: {
        2015: 80_500,
        2016: 80_500,
        2017: 83_000,
        2018: 85_500,
        2019: 88_000,
        2020: 90_500,
        2021: 93_000,
        2022: 96_000,
        2023: 99_400,
        2024: 102_900,
        2025: 106_500,
        2026: 110_200,
        2027: 114_100,
      },
      assumedAnnualRise: 0.035,
      roundTo: 100,
      basis:
        'After 2027, the latest cohort CPF Board has published, retirement sums are assumed to keep rising 3.5% a year, the rate CPF Board applied to the cohorts turning 55 from 2023 to 2027. This is an assumption for illustration, not a forecast: future sums are set by the Government.',
    },
    basicHealthcareSum: {
      // The BHS in force each year, which is the sum fixed for the cohort
      // turning 65 in that year.
      published: {
        2016: 49_800,
        2017: 52_000,
        2018: 54_500,
        2019: 57_200,
        2020: 60_000,
        2021: 63_000,
        2022: 66_000,
        2023: 68_500,
        2024: 71_500,
        2025: 75_500,
        2026: 79_000,
      },
      // (79,000 / 49,800) ^ (1 / 10) - 1 = 4.72%, the average annual rise
      // over the ten years published. A test recomputes it.
      assumedAnnualRise: 0.047,
      roundTo: 100,
      basis:
        'After 2026, the Basic Healthcare Sum is assumed to rise 4.7% a year, its average annual rise from 2016 to 2026. The Ministry of Health reviews it each year to keep pace with healthcare use, and publishes no rate in advance. This is an assumption for illustration, not a forecast.',
    },
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
