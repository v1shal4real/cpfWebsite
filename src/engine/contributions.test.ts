import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import type { RuleSet } from '@/rules';
import { CONTRIBUTION_FIXTURES } from './__fixtures__';
import type { ContributionFixture } from './__fixtures__/types';
import {
  NO_CONTRIBUTIONS_YET,
  bandAge,
  bandForMonth,
  contributionForMonth,
  contributionOnWage,
} from './contributions';

/**
 * A rule set carrying the rates and ceiling a fixture was published under.
 *
 * A worked example from 2024 is still a valid test of the engine, as long as
 * the engine is handed 2024's parameters. Building them into a rule set rather
 * than into the engine is the point: nothing in the calculation knows what
 * year it is.
 */
function rulesFor(fixture: ContributionFixture): RuleSet {
  const { assumes } = fixture;
  const rules = structuredClone(CURRENT_RULE_SET);
  rules.id = `fixture:${fixture.id}`;
  rules.wageCeilings.ordinaryWageCeiling = assumes.ordinaryWageCeiling / 100;
  rules.contributionRates.bands = [
    {
      throughAge: assumes.throughAge,
      employee: assumes.employee,
      employer: assumes.total - assumes.employee,
    },
  ];
  return rules;
}

/** An age inside the fixture's band: its birthday month, or 71 for the open band. */
const ageInMonthsFor = (fixture: ContributionFixture) => (fixture.assumes.throughAge ?? 71) * 12;

describe('CPF Board worked examples', () => {
  const cases = CONTRIBUTION_FIXTURES.map((fixture) => [fixture.id, fixture] as const);

  it.each(cases)('%s matches exactly', (_id, fixture) => {
    const rules = rulesFor(fixture);

    if (fixture.component === 'ordinary') {
      const result = contributionForMonth({
        rules,
        ageInMonths: ageInMonthsFor(fixture),
        ordinaryWage: fixture.wagePaid ?? fixture.wageSubjectToCpf,
        yearToDate: NO_CONTRIBUTIONS_YET,
      });
      expect(result.ordinaryWageSubjectToCpf).toBe(fixture.wageSubjectToCpf);
      expect(result.total).toBe(fixture.expected.total);
      expect(result.employee).toBe(fixture.expected.employee);
      expect(result.employer).toBe(fixture.expected.employer);
      return;
    }

    // Additional Wages: CPF Board rounds each wage component on its own, and
    // the AW ceiling that decides how much is subject to CPF is v2 work, so
    // the fixture supplies the amount already subject and this exercises the
    // rates and rounding.
    const band = bandForMonth(rules, ageInMonthsFor(fixture));
    expect(contributionOnWage(fixture.wageSubjectToCpf, band)).toEqual({
      total: fixture.expected.total,
      employee: fixture.expected.employee,
      employer: fixture.expected.employer,
    });
  });

  it('covers every fixture', () => {
    expect(CONTRIBUTION_FIXTURES.length).toBeGreaterThan(0);
  });
});

describe('age bands', () => {
  it('keeps the old band in the birthday month and changes the month after', () => {
    // CPF applies a new band from the month after the birthday month.
    expect(bandAge(54 * 12 + 11)).toBe(55);
    expect(bandAge(55 * 12)).toBe(55);
    expect(bandAge(55 * 12 + 1)).toBe(56);
  });

  it('reads the band from the rule set', () => {
    const atFiftyFive = bandForMonth(CURRENT_RULE_SET, 55 * 12);
    expect(atFiftyFive).toMatchObject({ throughAge: 55, employee: 0.2, employer: 0.17 });

    const monthAfter = bandForMonth(CURRENT_RULE_SET, 55 * 12 + 1);
    expect(monthAfter).toMatchObject({ throughAge: 60, employee: 0.18, employer: 0.16 });

    expect(bandForMonth(CURRENT_RULE_SET, 71 * 12)).toMatchObject({ throughAge: null });
  });
});

describe('ceilings', () => {
  const request = (overrides: Partial<Parameters<typeof contributionForMonth>[0]> = {}) => ({
    rules: CURRENT_RULE_SET,
    ageInMonths: 30 * 12,
    ordinaryWage: 500_000,
    yearToDate: NO_CONTRIBUTIONS_YET,
    ...overrides,
  });

  it('caps the wage at the Ordinary Wage ceiling', () => {
    const ceiling = CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling * 100;
    const atCeiling = contributionForMonth(request({ ordinaryWage: ceiling }));
    const above = contributionForMonth(request({ ordinaryWage: ceiling * 3 }));

    expect(above.ordinaryWageSubjectToCpf).toBe(ceiling);
    expect(above).toEqual(atCeiling);
    // The published maximum contribution on OW for this band.
    expect(above.total).toBe(296_000);
    expect(above.employee).toBe(160_000);
  });

  it('stops counting wages once the annual salary ceiling is used up', () => {
    const annual = CURRENT_RULE_SET.wageCeilings.annualSalaryCeiling * 100;
    const result = contributionForMonth(
      request({
        ordinaryWage: 800_000,
        yearToDate: { ordinaryWagesSubjectToCpf: annual - 100_000, contributions: 0 },
      }),
    );
    expect(result.ordinaryWageSubjectToCpf).toBe(100_000);
    expect(result.total).toBe(37_000);
  });

  it('stops contributions at the Annual Limit', () => {
    const limit = CURRENT_RULE_SET.wageCeilings.annualLimit * 100;
    const result = contributionForMonth(
      request({ ordinaryWage: 800_000, yearToDate: { ordinaryWagesSubjectToCpf: 0, contributions: limit - 5_000 } }),
    );
    expect(result.total).toBe(5_000);
    expect(result.employee + result.employer).toBe(result.total);

    const exhausted = contributionForMonth(
      request({ ordinaryWage: 800_000, yearToDate: { ordinaryWagesSubjectToCpf: 0, contributions: limit } }),
    );
    expect(exhausted.total).toBe(0);
  });

  it('refuses a wage the rule set has no rates for', () => {
    const threshold = CURRENT_RULE_SET.contributionRates.fullRatesFromMonthlyWage * 100;
    expect(() => contributionForMonth(request({ ordinaryWage: threshold }))).toThrow(RangeError);
    expect(() => contributionForMonth(request({ ordinaryWage: 50_000 }))).toThrow(
      /graduated rates/,
    );
    // A dollar above the threshold is fine.
    expect(() => contributionForMonth(request({ ordinaryWage: threshold + 100 }))).not.toThrow();
  });
});

describe('rounding', () => {
  const band = { throughAge: 55, employee: 0.2, employer: 0.17 };

  it('rounds the total to the nearest dollar and the employee share down', () => {
    // $13,795.58 x 37% = $5,104.36, and x 20% = $2,759.116.
    expect(contributionOnWage(1_379_558, band)).toEqual({
      total: 510_400,
      employee: 275_900,
      employer: 234_500,
    });
    // $23,572.64 x 37% = $8,721.88, which rounds up.
    expect(contributionOnWage(2_357_264, band).total).toBe(872_200);
  });

  it('rounds up from half a dollar and down below it', () => {
    // $501.36 x 37% = $185.5032, just over the half dollar.
    expect(contributionOnWage(50_136, band).total).toBe(18_600);
    // $501.35 x 37% = $185.4995, just under it.
    expect(contributionOnWage(50_135, band).total).toBe(18_500);
  });

  it('gives the employer the rounding remainder', () => {
    const result = contributionOnWage(1_379_558, band);
    expect(result.employer).toBe(result.total - result.employee);
    // Computed from its own rate, the employer's share would be $2,345.25,
    // which is not what CPF Board's example shows.
    expect(result.employer).not.toBe(Math.round(1_379_558 * 0.17));
  });
});
