import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { ALLOCATION_FIXTURES } from './__fixtures__';
import { allocateContribution, allocationBandForMonth, splitContribution } from './allocation';

const FULL_RETIREMENT_SUM = CURRENT_RULE_SET.thresholds.fullRetirementSum * 100;

const request = (overrides: Partial<Parameters<typeof allocateContribution>[0]> = {}) => ({
  rules: CURRENT_RULE_SET,
  ageInMonths: 30 * 12,
  total: 185_000,
  retirementBalance: 0,
  fullRetirementSum: FULL_RETIREMENT_SUM,
  ...overrides,
});

const sumOf = (amounts: Record<string, number>) =>
  Object.values(amounts).reduce((running, amount) => running + amount, 0);

describe('CPF Board worked examples', () => {
  it.each(ALLOCATION_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    '%s matches exactly',
    (_id, fixture) => {
      // The birthday month of the stated age, which is inside that age's band.
      const result = allocateContribution(
        request({ ageInMonths: fixture.age * 12, total: fixture.contribution }),
      );
      const secondAccount = fixture.age > 55 ? 'retirement' : 'special';
      expect(result.medisave).toBe(fixture.expected.medisave);
      expect(result[secondAccount]).toBe(fixture.expected.specialOrRetirement);
      expect(result.ordinary).toBe(fixture.expected.ordinary);
      expect(sumOf(result)).toBe(fixture.contribution);
    },
  );

  it('covers every fixture', () => {
    expect(ALLOCATION_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('order and conservation', () => {
  it('never creates or loses a cent, at any age or amount', () => {
    for (let age = 16; age <= 80; age++) {
      for (const total of [0, 1, 99, 18_500, 185_001, 296_000, 3_774_000]) {
        for (const ageInMonths of [age * 12, age * 12 + 1]) {
          const result = allocateContribution(request({ ageInMonths, total }));
          expect(sumOf(result), `age ${ageInMonths}m, ${total}c`).toBe(total);
          for (const amount of Object.values(result)) expect(amount).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('computes Ordinary as the remainder, not from its own ratio', () => {
    const band = allocationBandForMonth(CURRENT_RULE_SET, 30 * 12);
    // $1: MediSave 21.62c rounds to 22c, Special 16.21c to 16c, so Ordinary
    // takes 62c where its own ratio would give 62.17c.
    expect(splitContribution(100, band)).toEqual({ medisave: 22, specialOrRetirement: 16, ordinary: 62 });
  });

  it('rounds each share to the nearest cent, half a cent up (provisional)', () => {
    const band = { throughAge: null, ordinary: 0.25, specialOrRetirement: 0.25, medisave: 0.5 };
    // Half a cent to MediSave rounds up; a quarter cent to Special rounds down.
    expect(splitContribution(1, band)).toEqual({ medisave: 1, specialOrRetirement: 0, ordinary: 0 });
    // 0.75c rounds up.
    expect(splitContribution(3, band)).toEqual({ medisave: 2, specialOrRetirement: 1, ordinary: 0 });
  });
});

describe('age bands', () => {
  it('changes band the month after the birthday, as contributions do', () => {
    expect(allocationBandForMonth(CURRENT_RULE_SET, 35 * 12)).toMatchObject({ medisave: 0.2162 });
    expect(allocationBandForMonth(CURRENT_RULE_SET, 35 * 12 + 1)).toMatchObject({ medisave: 0.2432 });
    expect(allocationBandForMonth(CURRENT_RULE_SET, 71 * 12)).toMatchObject({ throughAge: null });
  });

  it('sends the second share to Special until the month after the 55th birthday', () => {
    const birthdayMonth = allocateContribution(request({ ageInMonths: 55 * 12 }));
    expect(birthdayMonth.special).toBeGreaterThan(0);
    expect(birthdayMonth.retirement).toBe(0);

    const monthAfter = allocateContribution(request({ ageInMonths: 55 * 12 + 1 }));
    expect(monthAfter.special).toBe(0);
    expect(monthAfter.retirement).toBeGreaterThan(0);
  });
});

describe('from 55, the Retirement Account up to the Full Retirement Sum', () => {
  const age57 = 57 * 12;
  // $100 at 57: $33.82 to the second share, $35.30 to Ordinary.
  const at57 = (retirementBalance: number) =>
    allocateContribution(request({ ageInMonths: age57, total: 10_000, retirementBalance }));

  it('takes the whole share while there is room', () => {
    expect(at57(0)).toEqual({ ordinary: 3_530, special: 0, medisave: 3_088, retirement: 3_382 });
  });

  it('fills the Retirement Account to the sum and sends the rest to Ordinary', () => {
    const result = at57(FULL_RETIREMENT_SUM - 1_000);
    expect(result.retirement).toBe(1_000);
    expect(result.ordinary).toBe(3_530 + 2_382);
    expect(result.medisave).toBe(3_088);
  });

  it('sends the whole share to Ordinary once the sum is reached or passed', () => {
    for (const balance of [FULL_RETIREMENT_SUM, FULL_RETIREMENT_SUM + 500_000]) {
      expect(at57(balance)).toEqual({ ordinary: 3_530 + 3_382, special: 0, medisave: 3_088, retirement: 0 });
    }
  });
});
