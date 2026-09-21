import type { ContributionAssumptions, ContributionFixture } from './types';

/*
 * The rules each group of examples was computed under. Rates and ceilings are
 * copied from the rate table in force at the time, not inferred from the
 * example's own figures.
 */

const table2026 = (locator: string) => ({ sourceId: 'contributionRateTable2026', locator }) as const;
const table2024 = { sourceId: 'contributionRateTable2024', locator: 'Table 1, page 1' } as const;
const awExample = (locator: string) => ({ sourceId: 'additionalWageCeilingExamples', locator }) as const;

const RULES_2026 = {
  cite: table2026('Table 1, page 1'),
  ordinaryWageCeiling: 800_000,
} as const;

const BELOW_55_2024: ContributionAssumptions = {
  cite: table2024,
  ordinaryWageCeiling: 680_000,
  throughAge: 55,
  total: 0.37,
  employee: 0.2,
};

const ABOVE_55_TO_60_2024: ContributionAssumptions = {
  cite: table2024,
  ordinaryWageCeiling: 680_000,
  throughAge: 60,
  total: 0.31,
  employee: 0.16,
};

/**
 * Contribution amounts published by CPF Board.
 *
 * The rounding every fixture here follows is stated on both rate tables:
 * round the total to the nearest dollar (50 cents rounds up), round the
 * employee's share down to the dollar, and the employer pays the difference.
 */
export const CONTRIBUTION_FIXTURES: readonly ContributionFixture[] = [
  /*
   * OW ceiling cases, 2026. The rate table prints the maximum contribution on
   * Ordinary Wages for each band: the contribution on wages at the $8,000
   * ceiling, and on any wage above it.
   */
  {
    id: 'ow-ceiling-2026-55-and-below',
    description: 'Maximum contribution on OW, 55 and below',
    cite: table2026('Table 1, page 1, "55 & below", > $750'),
    assumes: { ...RULES_2026, throughAge: 55, total: 0.37, employee: 0.2 },
    component: 'ordinary',
    wageSubjectToCpf: 800_000,
    expected: { total: 296_000, employee: 160_000, employer: 136_000 },
  },
  {
    id: 'ow-ceiling-2026-above-55-to-60',
    description: 'Maximum contribution on OW, above 55 to 60',
    cite: table2026('Table 1, page 1, "Above 55 - 60", > $750'),
    assumes: { ...RULES_2026, throughAge: 60, total: 0.34, employee: 0.18 },
    component: 'ordinary',
    wageSubjectToCpf: 800_000,
    expected: { total: 272_000, employee: 144_000, employer: 128_000 },
  },
  {
    id: 'ow-ceiling-2026-above-60-to-65',
    description: 'Maximum contribution on OW, above 60 to 65',
    cite: table2026('Table 1, page 1, "Above 60 - 65", > $750'),
    assumes: { ...RULES_2026, throughAge: 65, total: 0.25, employee: 0.125 },
    component: 'ordinary',
    wageSubjectToCpf: 800_000,
    expected: { total: 200_000, employee: 100_000, employer: 100_000 },
  },
  {
    id: 'ow-ceiling-2026-above-65-to-70',
    description: 'Maximum contribution on OW, above 65 to 70',
    cite: table2026('Table 1, page 1, "Above 65 - 70", > $750'),
    assumes: { ...RULES_2026, throughAge: 70, total: 0.165, employee: 0.075 },
    component: 'ordinary',
    wageSubjectToCpf: 800_000,
    expected: { total: 132_000, employee: 60_000, employer: 72_000 },
  },
  {
    id: 'ow-ceiling-2026-above-70',
    description: 'Maximum contribution on OW, above 70',
    cite: table2026('Table 1, page 1, "Above 70", > $750'),
    assumes: { ...RULES_2026, throughAge: null, total: 0.125, employee: 0.05 },
    component: 'ordinary',
    wageSubjectToCpf: 800_000,
    expected: { total: 100_000, employee: 40_000, employer: 60_000 },
  },

  /*
   * Monthly Ordinary Wages from the Additional Wage ceiling examples, 2024.
   * Only the OW columns are used here; the AW ceiling itself is v2 work.
   */
  {
    id: 'aw-example-1-ow-above-ceiling',
    description: 'Below 55, salary $7,000 capped at the $6,800 OW ceiling',
    cite: awExample('Example 1, page 2'),
    assumes: BELOW_55_2024,
    component: 'ordinary',
    wagePaid: 700_000,
    wageSubjectToCpf: 680_000,
    expected: { total: 251_600, employee: 136_000, employer: 115_600 },
  },
  {
    id: 'aw-example-2-ow-below-ceiling',
    description: 'Below 55, salary $4,500, under the OW ceiling',
    cite: awExample('Example 2, page 3'),
    assumes: BELOW_55_2024,
    component: 'ordinary',
    wagePaid: 450_000,
    wageSubjectToCpf: 450_000,
    expected: { total: 166_500, employee: 90_000, employer: 76_500 },
  },
  {
    id: 'aw-example-10-ow-after-turning-55',
    description:
      'Turned 55 in June 2024 on a $10,000 salary; July to December use the above-55 rates on the capped $6,800',
    cite: awExample('Example 10, page 12, July to December rows'),
    assumes: ABOVE_55_TO_60_2024,
    component: 'ordinary',
    wagePaid: 1_000_000,
    wageSubjectToCpf: 680_000,
    expected: { total: 210_800, employee: 108_800, employer: 102_000 },
  },
  {
    id: 'aw-example-11-ow-after-turning-55',
    description: 'Turned 55 in June 2024; salary $5,000 from July, under the OW ceiling',
    cite: awExample('Example 11, page 13, July to December rows'),
    assumes: ABOVE_55_TO_60_2024,
    component: 'ordinary',
    wagePaid: 500_000,
    wageSubjectToCpf: 500_000,
    expected: { total: 155_000, employee: 80_000, employer: 75_000 },
  },
  {
    id: 'aw-example-13-prorated-final-month',
    description: 'Above 55, left employment in November 2024 on a prorated salary of $2,000',
    cite: awExample('Example 13, page 15, November row'),
    assumes: ABOVE_55_TO_60_2024,
    component: 'ordinary',
    wagePaid: 200_000,
    wageSubjectToCpf: 200_000,
    expected: { total: 62_000, employee: 32_000, employer: 30_000 },
  },

  /*
   * Rounding cases. These are the only published examples found whose wages
   * carry cents, so they are the only ones that exercise the rounding rules.
   * They are Additional Wage amounts already capped by the AW ceiling; the
   * rounding is the same whichever component the wage belongs to.
   */
  {
    id: 'aw-example-9-march-rounds-total-down',
    description: 'Below 55, AW of $13,795.58: total $5,104.36 rounds down, employee $2,759.12 rounds down',
    cite: awExample('Example 9, page 11, March 2024 row'),
    assumes: BELOW_55_2024,
    component: 'additional',
    wageSubjectToCpf: 1_379_558,
    expected: { total: 510_400, employee: 275_900, employer: 234_500 },
  },
  {
    id: 'aw-example-9-june-rounds-total-down',
    description: 'Below 55, AW of $17,227.36: total $6,374.12, employee $3,445.47 rounds down',
    cite: awExample('Example 9, page 11, June 2024 row'),
    assumes: BELOW_55_2024,
    component: 'additional',
    wageSubjectToCpf: 1_722_736,
    expected: { total: 637_400, employee: 344_500, employer: 292_900 },
  },
  {
    id: 'aw-example-9-july-rounds-total-up',
    description: 'Below 55, AW of $23,572.64: total $8,721.88 rounds up, employee $4,714.53 rounds down',
    cite: awExample('Example 9, page 11, July 2024 row'),
    assumes: BELOW_55_2024,
    component: 'additional',
    wageSubjectToCpf: 2_357_264,
    expected: { total: 872_200, employee: 471_400, employer: 400_800 },
  },
  {
    id: 'aw-example-14-july-above-55-rounds-total-up',
    description: 'Above 55, AW of $23,572.64: total $7,307.52 rounds up, employee $3,771.62 rounds down',
    cite: awExample('Example 14, page 17, July 2024 row'),
    assumes: ABOVE_55_TO_60_2024,
    component: 'additional',
    wageSubjectToCpf: 2_357_264,
    expected: { total: 730_800, employee: 377_100, employer: 353_700 },
  },
];
