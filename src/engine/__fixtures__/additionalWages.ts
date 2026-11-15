import type { AdditionalWageYearFixture } from './types';

/*
 * CPF Board, "Examples for computation of Additional Wage (AW) Ceiling", 2024.
 * The AW ceiling is "$102,000 - Total Ordinary Wages (OW) subject to CPF for
 * the year", re-calculated in December on the actual OW. Figures are CPF
 * Board's, in cents. Where the source re-calculates mid-year (Example 3), the
 * re-calculated figures are the ones transcribed: they are what the year
 * settles at.
 *
 * Not transcribed: the examples where the employee joins, leaves or re-joins
 * during the year (5 to 9, 12 to 15). The projection models one continuous
 * job, so it has no input that could reproduce them. Example 16 has a $500
 * salary, which attracts graduated rates the rule sets do not encode.
 */

const aw = (locator: string) => ({ sourceId: 'additionalWageCeilingExamples', locator }) as const;

const RULES_2024 = {
  cite: { sourceId: 'contributionRateTable2024', locator: 'Table 1, page 1' },
  ordinaryWageCeiling: 680_000,
  annualSalaryCeiling: 10_200_000,
  bands: [
    { throughAge: 55, total: 0.37, employee: 0.2 },
    { throughAge: 60, total: 0.31, employee: 0.16 },
  ],
} as const;

const twelve = (wage: number) => Array.from({ length: 12 }, () => wage);

export const ADDITIONAL_WAGE_FIXTURES: readonly AdditionalWageYearFixture[] = [
  {
    id: 'aw-ceiling-example-1',
    description: 'Below 55, $7,000 salary, $100,000 of AW: OW capped at $6,800, so the AW ceiling is $20,400',
    cite: aw('Example 1, page 2'),
    assumes: RULES_2024,
    ordinaryWagePaid: twelve(700_000),
    expectedCeiling: 2_040_000,
    payments: [
      {
        month: 1,
        additionalWagePaid: 1_200_000,
        expected: { subjectToCpf: 1_200_000, employer: 204_000, employee: 240_000 },
      },
      {
        month: 6,
        additionalWagePaid: 1_000_000,
        expected: { subjectToCpf: 840_000, employer: 142_800, employee: 168_000 },
      },
      { month: 12, additionalWagePaid: 7_800_000, expected: { subjectToCpf: 0, employer: 0, employee: 0 } },
    ],
  },
  {
    id: 'aw-ceiling-example-2',
    description: 'Below 55, $4,500 salary, $100,000 of AW: AW ceiling $48,000',
    cite: aw('Example 2, page 3'),
    assumes: RULES_2024,
    ordinaryWagePaid: twelve(450_000),
    expectedCeiling: 4_800_000,
    payments: [
      {
        month: 2,
        additionalWagePaid: 500_000,
        expected: { subjectToCpf: 500_000, employer: 85_000, employee: 100_000 },
      },
      {
        month: 3,
        additionalWagePaid: 4_000_000,
        expected: { subjectToCpf: 4_000_000, employer: 680_000, employee: 800_000 },
      },
      {
        month: 12,
        additionalWagePaid: 5_500_000,
        expected: { subjectToCpf: 300_000, employer: 51_000, employee: 60_000 },
      },
    ],
  },
  {
    id: 'aw-ceiling-example-3',
    description: 'Below 55, salary rises from $4,500 to $6,000 in April: AW ceiling re-calculated to $34,500',
    cite: aw('Example 3, page 4'),
    assumes: RULES_2024,
    ordinaryWagePaid: [450_000, 450_000, 450_000, ...Array.from({ length: 9 }, () => 600_000)],
    expectedCeiling: 3_450_000,
    payments: [
      {
        month: 1,
        additionalWagePaid: 2_000_000,
        expected: { subjectToCpf: 2_000_000, employer: 340_000, employee: 400_000 },
      },
      {
        month: 4,
        additionalWagePaid: 3_000_000,
        expected: { subjectToCpf: 1_450_000, employer: 246_500, employee: 290_000 },
      },
      { month: 12, additionalWagePaid: 5_000_000, expected: { subjectToCpf: 0, employer: 0, employee: 0 } },
    ],
  },
  {
    id: 'aw-ceiling-example-10',
    description:
      'Turns 55 in June on a $10,000 salary: AW after June is at the 55-to-60 rates, capped at the $5,400 left',
    cite: aw('Example 10, page 12'),
    assumes: RULES_2024,
    turns55InMonth: 6,
    ordinaryWagePaid: twelve(1_000_000),
    expectedCeiling: 2_040_000,
    payments: [
      {
        month: 2,
        additionalWagePaid: 500_000,
        expected: { subjectToCpf: 500_000, employer: 85_000, employee: 100_000 },
      },
      {
        month: 4,
        additionalWagePaid: 500_000,
        expected: { subjectToCpf: 500_000, employer: 85_000, employee: 100_000 },
      },
      {
        month: 6,
        additionalWagePaid: 500_000,
        expected: { subjectToCpf: 500_000, employer: 85_000, employee: 100_000 },
      },
      {
        month: 8,
        additionalWagePaid: 2_000_000,
        expected: { subjectToCpf: 540_000, employer: 81_000, employee: 86_400 },
      },
      { month: 10, additionalWagePaid: 6_500_000, expected: { subjectToCpf: 0, employer: 0, employee: 0 } },
    ],
  },
];
