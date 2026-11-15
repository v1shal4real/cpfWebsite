import { RULE_SET_2026 } from './ruleset-2026';
import type { RuleSet } from './types';

/**
 * CPF rules in force from 1 January 2027.
 *
 * Verified on 15 November 2026 against the pages named below. Only what
 * changed on 1 January 2027 differs from `RULE_SET_2026`; every other figure
 * is carried over unchanged and was re-checked as still in force:
 *
 *   - Contribution rates: above 55 to 60 rises from 34% to 35.5% (employee
 *     19%, employer 16.5%); above 60 to 65 from 25% to 26% (13% each). Other
 *     bands, the $8,000 OW ceiling and the $750 full-rate threshold are
 *     unchanged. (`changes2027`, `contributionRateTable2027`.)
 *   - Allocation: the increase for ages above 55 to 65 goes to the Retirement
 *     Account, so those two bands have new ratios. (`allocationRates2027`.)
 *   - Interest: the 4% floor on SA, MA and RA monies is extended to
 *     31 December 2027. (`interestFloor2027`.) The OA rate stays at its 2.5%
 *     statutory floor, and with it the HDB loan rate at 2.6%.
 *   - Retirement sums for members turning 55 in 2027, all published: BRS
 *     $114,100, FRS $228,200, ERS $456,400.
 *
 * Not yet published: the 2027 Basic Healthcare Sum, announced each January.
 * The figure below is 2026's, labelled with its year in the interface, and the
 * projection applies the stated escalation assumption for 2027 meanwhile.
 * When CPF Board announces it, record it in the escalation series' published
 * figures and here.
 */
export const RULE_SET_2027: RuleSet = {
  ...RULE_SET_2026,
  id: 'sg-cpf-2027-01',
  label: '1 January 2027',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  verified: true,

  contributionRates: {
    sourceId: 'changes2027',
    fieldSources: { fullRatesFromMonthlyWage: 'contributionRateTable2027' },
    fullRatesFromMonthlyWage: 750,
    bands: [
      { throughAge: 55, employee: 0.2, employer: 0.17 },
      { throughAge: 60, employee: 0.19, employer: 0.165 },
      { throughAge: 65, employee: 0.13, employer: 0.13 },
      { throughAge: 70, employee: 0.075, employer: 0.09 },
      { throughAge: null, employee: 0.05, employer: 0.075 },
    ],
  },

  allocation: {
    sourceId: 'allocationRates2027',
    bands: [
      { throughAge: 35, ordinary: 0.6217, specialOrRetirement: 0.1621, medisave: 0.2162 },
      { throughAge: 45, ordinary: 0.5677, specialOrRetirement: 0.1891, medisave: 0.2432 },
      { throughAge: 50, ordinary: 0.5136, specialOrRetirement: 0.2162, medisave: 0.2702 },
      { throughAge: 55, ordinary: 0.4055, specialOrRetirement: 0.3108, medisave: 0.2837 },
      { throughAge: 60, ordinary: 0.3382, specialOrRetirement: 0.3661, medisave: 0.2957 },
      { throughAge: 65, ordinary: 0.1347, specialOrRetirement: 0.4615, medisave: 0.4038 },
      { throughAge: 70, ordinary: 0.0607, specialOrRetirement: 0.303, medisave: 0.6363 },
      { throughAge: null, ordinary: 0.08, specialOrRetirement: 0.08, medisave: 0.84 },
    ],
  },

  interest: {
    ...RULE_SET_2026.interest,
    sourceId: 'interestFloor2027',
    fieldSources: { extraInterestCountingOrder: 'extraInterest' },
  },

  thresholds: {
    ...RULE_SET_2026.thresholds,
    basicRetirementSum: 114_100,
    fullRetirementSum: 228_200,
    enhancedRetirementSum: 456_400,
  },
};
