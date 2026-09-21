import type { AllocationFixture } from './types';

const allocationPdf = (locator: string) => ({ sourceId: 'allocationRates', locator }) as const;

/**
 * Allocation splits published by CPF Board.
 *
 * Both examples show the order the engine must follow: MediSave first, then
 * Special or Retirement, and the Ordinary Account takes the remainder, written
 * on the page as "$100 - $21.62 - $16.21".
 *
 * TODO: neither example exercises rounding. A $100 contribution times a
 * four-place ratio always lands on whole cents. No published example was found
 * that rounds a share; see `index.ts` for the pages checked.
 */
export const ALLOCATION_FIXTURES: readonly AllocationFixture[] = [
  {
    id: 'allocation-example-1-age-30',
    description: 'Age 30, $100 contribution',
    cite: allocationPdf('Example 1, page 1'),
    age: 30,
    contribution: 10_000,
    ratios: { specialOrRetirement: 0.1621, medisave: 0.2162 },
    expected: { ordinary: 6_217, specialOrRetirement: 1_621, medisave: 2_162 },
  },
  {
    id: 'allocation-example-2-age-57',
    description: 'Age 57, $100 contribution; the second share goes to the Retirement Account',
    cite: allocationPdf('Example 2, page 1'),
    age: 57,
    contribution: 10_000,
    ratios: { specialOrRetirement: 0.3382, medisave: 0.3088 },
    expected: { ordinary: 3_530, specialOrRetirement: 3_382, medisave: 3_088 },
  },
];
