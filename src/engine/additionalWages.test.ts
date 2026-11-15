import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET, type RuleSet } from '@/rules';
import { ADDITIONAL_WAGE_FIXTURES } from './__fixtures__';
import type { AdditionalWageYearFixture } from './__fixtures__/types';
import {
  NO_CONTRIBUTIONS_YET,
  additionalWageCeiling,
  contributionForMonth,
  contributionOnAdditionalWage,
  ordinaryWagesSubjectToCpfForYear,
  type YearToDate,
} from './contributions';
import { project } from './project';
import type { ProjectionInput } from './types';

/** A rule set with the rates and ceilings a 2024 example was computed under. */
function rulesFor(fixture: AdditionalWageYearFixture): RuleSet {
  const rules = structuredClone(CURRENT_RULE_SET);
  rules.id = `fixture:${fixture.id}`;
  rules.wageCeilings.ordinaryWageCeiling = fixture.assumes.ordinaryWageCeiling / 100;
  rules.wageCeilings.annualSalaryCeiling = fixture.assumes.annualSalaryCeiling / 100;
  rules.contributionRates.bands = [
    ...fixture.assumes.bands.map((band) => ({
      throughAge: band.throughAge,
      employee: band.employee,
      employer: band.total - band.employee,
    })),
    // An open-ended band, as every real rule set has; no fixture reaches it.
    { throughAge: null, employee: 0.05, employer: 0.075 },
  ];
  return rules;
}

/** Age in months in a calendar month: 55 in the birthday month, as CPF counts it. */
function ageInMonths(fixture: AdditionalWageYearFixture, month: number): number {
  const birthday = fixture.turns55InMonth ?? 13;
  return 55 * 12 + (month - birthday);
}

describe('CPF Board Additional Wage ceiling examples', () => {
  it.each(ADDITIONAL_WAGE_FIXTURES.map((f) => [f.id, f] as const))(
    '%s matches CPF Board month by month',
    (_id, fixture) => {
      const rules = rulesFor(fixture);
      const ceiling = additionalWageCeiling(
        rules,
        ordinaryWagesSubjectToCpfForYear(
          fixture.ordinaryWagePaid.map((ordinaryWage) => ({ ordinaryWage, rules })),
        ),
      );
      expect(ceiling).toBe(fixture.expectedCeiling);

      let yearToDate: YearToDate = { ...NO_CONTRIBUTIONS_YET };
      for (let month = 1; month <= 12; month++) {
        const age = ageInMonths(fixture, month);
        const ow = contributionForMonth({
          rules,
          ageInMonths: age,
          ordinaryWage: fixture.ordinaryWagePaid[month - 1]!,
          yearToDate,
        });
        yearToDate = {
          ...yearToDate,
          ordinaryWagesSubjectToCpf: yearToDate.ordinaryWagesSubjectToCpf + ow.ordinaryWageSubjectToCpf,
          contributions: yearToDate.contributions + ow.total,
        };

        const payment = fixture.payments.find((p) => p.month === month);
        const result = contributionOnAdditionalWage({
          rules,
          ageInMonths: age,
          additionalWage: payment?.additionalWagePaid ?? 0,
          ceiling,
          yearToDate,
        });
        if (payment) {
          expect({
            month,
            subjectToCpf: result.additionalWageSubjectToCpf,
            employer: result.employer,
            employee: result.employee,
          }).toEqual({ month, ...payment.expected });
        } else {
          expect(result.total).toBe(0);
        }
        yearToDate = {
          ...yearToDate,
          additionalWagesSubjectToCpf:
            yearToDate.additionalWagesSubjectToCpf + result.additionalWageSubjectToCpf,
          contributions: yearToDate.contributions + result.total,
        };
      }

      const totalSubject = fixture.payments.reduce((sum, p) => sum + p.expected.subjectToCpf, 0);
      expect(yearToDate.additionalWagesSubjectToCpf).toBe(totalSubject);
    },
  );
});

describe('Additional Wage edge cases', () => {
  const rules = CURRENT_RULE_SET;
  const base = { rules, ageInMonths: 30 * 12, ceiling: 2_000_000, yearToDate: NO_CONTRIBUTIONS_YET };

  it('charges nothing on no AW', () => {
    expect(contributionOnAdditionalWage({ ...base, additionalWage: 0 }).total).toBe(0);
  });

  it('charges nothing once the AW ceiling is used up', () => {
    const used = { ...NO_CONTRIBUTIONS_YET, additionalWagesSubjectToCpf: 2_000_000 };
    const result = contributionOnAdditionalWage({ ...base, additionalWage: 500_000, yearToDate: used });
    expect(result).toEqual({ additionalWageSubjectToCpf: 0, total: 0, employee: 0, employer: 0 });
  });

  it('has a zero ceiling when Ordinary Wages already use the annual ceiling', () => {
    const annual = rules.wageCeilings.annualSalaryCeiling * 100;
    expect(additionalWageCeiling(rules, annual)).toBe(0);
    expect(additionalWageCeiling(rules, annual + 1)).toBe(0);
  });

  it('caps OW and AW contributions together at the Annual Limit', () => {
    const limit = rules.wageCeilings.annualLimit * 100;
    const nearly = { ...NO_CONTRIBUTIONS_YET, contributions: limit - 10_000 };
    const result = contributionOnAdditionalWage({ ...base, additionalWage: 500_000, yearToDate: nearly });
    expect(result.total).toBe(10_000);
    expect(result.employee + result.employer).toBe(10_000);
  });

  it('never lets OW and AW subject to CPF exceed the annual salary ceiling in a year', () => {
    const annual = rules.wageCeilings.annualSalaryCeiling * 100;
    for (const wage of [300_000, 650_000, 800_000, 1_200_000]) {
      const ow = ordinaryWagesSubjectToCpfForYear(
        Array.from({ length: 12 }, () => ({ ordinaryWage: wage, rules })),
      );
      expect(ow + additionalWageCeiling(rules, ow)).toBe(Math.max(annual, ow));
    }
  });
});

describe('a projection with an annual bonus', () => {
  const input: ProjectionInput = {
    startMonth: '2026-01',
    startAge: 30,
    endAge: 40,
    openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: 0 },
    monthlyOrdinaryWage: 500_000,
    salaryGrowth: { rate: 0.03, appliedInMonth: 1 },
    annualBonus: { monthsOfSalary: 2, paidInMonth: 12 },
  };
  const withBonus = project(input);
  const without = project({ ...input, annualBonus: undefined });

  it('pays the bonus in its month, as months of that month’s salary', () => {
    const december = withBonus.months.find((m) => m.month === '2027-12')!;
    expect(december.contribution.additionalWage).toBe(december.ordinaryWage * 2);
    const november = withBonus.months.find((m) => m.month === '2027-11')!;
    expect(november.contribution.additionalWage).toBe(0);
  });

  it('adds the AW contribution to the month total, and allocates all of it', () => {
    for (const month of withBonus.months) {
      const { contribution } = month;
      expect(contribution.total).toBe(contribution.employee + contribution.employer);
      const allocated = Object.values(contribution.allocation).reduce((a, b) => a + b, 0);
      expect(allocated).toBe(contribution.total);
    }
    const dec = withBonus.months.find((m) => m.month === '2026-12')!;
    // $10,000 bonus under a $42,000 ceiling ($102,000 - 12 x $5,000): all of it at 37%.
    expect(dec.contribution.additionalWageSubjectToCpf).toBe(1_000_000);
    expect(dec.contribution.onAdditionalWage.total).toBe(370_000);
  });

  it('keeps each year’s OW and AW subject to CPF within the annual ceiling', () => {
    const annual = CURRENT_RULE_SET.wageCeilings.annualSalaryCeiling * 100;
    const byYear = new Map<string, number>();
    for (const m of withBonus.months) {
      const year = m.month.slice(0, 4);
      byYear.set(
        year,
        (byYear.get(year) ?? 0) +
          m.contribution.ordinaryWageSubjectToCpf +
          m.contribution.additionalWageSubjectToCpf,
      );
    }
    for (const total of byYear.values()) expect(total).toBeLessThanOrEqual(annual);
  });

  it('caps a large bonus at the AW ceiling', () => {
    const big = project({
      ...input,
      monthlyOrdinaryWage: 800_000,
      salaryGrowth: { rate: 0, appliedInMonth: 1 },
      annualBonus: { monthsOfSalary: 6, paidInMonth: 12 },
    });
    const dec = big.months.find((m) => m.month === '2026-12')!;
    // $102,000 - 12 x $8,000 = $6,000 of a $48,000 bonus.
    expect(dec.contribution.additionalWage).toBe(4_800_000);
    expect(dec.contribution.additionalWageSubjectToCpf).toBe(600_000);
  });

  it('raises balances, and changes nothing without a bonus', () => {
    const total = (r: typeof withBonus) => Object.values(r.summary.atEnd.balances).reduce((a, b) => a + b, 0);
    expect(total(withBonus)).toBeGreaterThan(total(without));
    expect(without.months.every((m) => m.contribution.additionalWage === 0)).toBe(true);
  });

  it('counts months before a mid-year start at the starting wage', () => {
    const midYear = project({
      ...input,
      startMonth: '2026-07',
      salaryGrowth: { rate: 0, appliedInMonth: 1 },
      annualBonus: { monthsOfSalary: 12, paidInMonth: 12 },
    });
    const dec = midYear.months.find((m) => m.month === '2026-12')!;
    // A full year at $5,000 is assumed, so the ceiling is $42,000, not $72,000.
    expect(dec.contribution.additionalWageSubjectToCpf).toBe(4_200_000);
  });
});
