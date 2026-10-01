import { describe, expect, it } from 'vitest';
import {
  CURRENT_RULE_SET,
  RULE_SETS,
  SOURCES,
  basicHealthcareSumForMember,
  basicHealthcareSumInYear,
  escalationAssumptions,
  figureForYear,
  lastPublishedYear,
  retirementSumsForCohort,
  sourceFor,
  type EscalatingSeries,
} from './index';

const eachSet = RULE_SETS.map((set) => [set.id, set] as const);
const { escalation, thresholds } = CURRENT_RULE_SET;

/**
 * The Full Retirement Sum by cohort as printed on CPF Board's "How much is my
 * Full Retirement Sum?", read on 1 October 2026. Not stored in the rule set,
 * because it is derived there from the BRS; held here to check the derivation.
 */
const PUBLISHED_FULL_RETIREMENT_SUM: Record<number, number> = {
  2015: 161_000,
  2016: 161_000,
  2017: 166_000,
  2018: 171_000,
  2019: 176_000,
  2020: 181_000,
  2021: 186_000,
  2022: 192_000,
  2023: 198_800,
  2024: 205_800,
  2025: 213_000,
  2026: 220_400,
  2027: 228_200,
};

/** A series cut short at a year, to escalate from it and compare with what was published after. */
function publishedThrough(series: EscalatingSeries, lastYear: number): EscalatingSeries {
  return {
    ...series,
    published: Object.fromEntries(
      Object.entries(series.published).filter(([year]) => Number(year) <= lastYear),
    ),
  };
}

describe('escalation data', () => {
  it.each(eachSet)('%s: published years run without gaps', (_id, set) => {
    for (const series of [set.escalation.basicRetirementSum, set.escalation.basicHealthcareSum]) {
      const years = Object.keys(series.published).map(Number).sort((a, b) => a - b);
      expect(years.at(-1)! - years[0]! + 1).toBe(years.length);
    }
  });

  it.each(eachSet)('%s: agrees with its own thresholds for the year it takes effect', (_id, set) => {
    const year = Number(set.effectiveFrom.slice(0, 4));
    expect(set.escalation.basicRetirementSum.published[year]).toBe(set.thresholds.basicRetirementSum);
    expect(set.escalation.basicHealthcareSum.published[year]).toBe(set.thresholds.basicHealthcareSum);
  });

  it.each(eachSet)('%s: states every assumption as an assumption, not a forecast', (_id, set) => {
    for (const series of [set.escalation.basicRetirementSum, set.escalation.basicHealthcareSum]) {
      expect(series.basis).toMatch(/assum/i);
      expect(series.basis).toMatch(/not a forecast/i);
      expect(series.assumedAnnualRise).toBeGreaterThan(0);
      expect(series.roundTo).toBeGreaterThan(0);
    }
  });

  it('cites the BRS and BHS pages that print the series', () => {
    expect(sourceFor(escalation)).toBe('basicRetirementSum');
    expect(sourceFor(escalation, 'basicHealthcareSum')).toBe('basicHealthcareSum');
    expect(SOURCES.basicHealthcareSum.title).toMatch(/Basic Healthcare Sum/);
  });

  it('assumes the BHS rises at its average from the first to the last published year', () => {
    const series = escalation.basicHealthcareSum;
    const years = Object.keys(series.published).map(Number).sort((a, b) => a - b);
    const first = years[0]!;
    const last = years.at(-1)!;
    const average = (series.published[last]! / series.published[first]!) ** (1 / (last - first)) - 1;
    // Stated to one decimal place of a percent: 4.72% is assumed as 4.7%.
    expect(series.assumedAnnualRise).toBeCloseTo(average, 3);
  });
});

describe('retirement sums', () => {
  it('returns the published BRS, and an FRS of twice it, for every published cohort', () => {
    for (const [year, full] of Object.entries(PUBLISHED_FULL_RETIREMENT_SUM)) {
      const sums = retirementSumsForCohort(CURRENT_RULE_SET, Number(year));
      expect(sums.basis, year).toBe('published');
      expect(sums.fullRetirementSum, year).toBe(full);
      expect(sums.basicRetirementSum, year).toBe(escalation.basicRetirementSum.published[Number(year)]);
    }
  });

  it('reproduces CPF Board’s own 2023 to 2027 figures from 2022 by the stated rule', () => {
    // CPF Board raised the BRS 3.5% a year for these cohorts, rounding to the
    // nearest $100. Escalating from 2022 alone must land on each one exactly,
    // which is what shows the method matches CPF Board's.
    const from2022 = publishedThrough(escalation.basicRetirementSum, 2022);
    for (const year of [2023, 2024, 2025, 2026, 2027]) {
      const figure = figureForYear(from2022, year);
      expect(figure.basis).toBe('assumed');
      expect(figure.amount, String(year)).toBe(escalation.basicRetirementSum.published[year]);
    }
  });

  it('carries the sums past the last published cohort by the assumption', () => {
    expect(lastPublishedYear(escalation.basicRetirementSum)).toBe(2027);
    // $114,100 x 1.035 = $118,093.50, to the nearest $100.
    const sums2028 = retirementSumsForCohort(CURRENT_RULE_SET, 2028);
    expect(sums2028).toEqual({
      yearTurning55: 2028,
      basicRetirementSum: 118_100,
      fullRetirementSum: 236_200,
      basis: 'assumed',
    });
  });

  it('compounds year on year, rounding each year', () => {
    let expected = 114_100;
    for (let year = 2028; year <= 2070; year++) {
      expected = Math.round((expected * 1.035) / 100) * 100;
      expect(retirementSumsForCohort(CURRENT_RULE_SET, year).basicRetirementSum, String(year)).toBe(expected);
    }
  });

  it('fixes a 30-year-old’s sums in 2051, well above today’s', () => {
    const sums = retirementSumsForCohort(CURRENT_RULE_SET, 2051);
    expect(sums.basicRetirementSum % 100).toBe(0);
    expect(sums.fullRetirementSum).toBe(sums.basicRetirementSum * 2);
    expect(sums.fullRetirementSum).toBeGreaterThan(thresholds.fullRetirementSum * 2);
  });

  it('gives the earliest recorded sums, marked as such, for a cohort before them', () => {
    const sums = retirementSumsForCohort(CURRENT_RULE_SET, 2012);
    expect(sums.basis).toBe('before-published');
    expect(sums.basicRetirementSum).toBe(80_500);
  });

  it('reads the rate and rounding from the rule set', () => {
    const doubling = { ...escalation.basicRetirementSum, assumedAnnualRise: 1, roundTo: 1 };
    expect(figureForYear(doubling, 2029).amount).toBe(114_100 * 4);
  });
});

describe('Basic Healthcare Sum', () => {
  it('returns the published BHS for every published year', () => {
    for (const [year, amount] of Object.entries(escalation.basicHealthcareSum.published)) {
      expect(basicHealthcareSumInYear(CURRENT_RULE_SET, Number(year))).toEqual({
        year: Number(year),
        amount,
        basis: 'published',
      });
    }
  });

  it('rises by the assumption after 2026', () => {
    // $79,000 x 1.047 = $82,713, to the nearest $100.
    expect(basicHealthcareSumInYear(CURRENT_RULE_SET, 2027)).toEqual({
      year: 2027,
      amount: 82_700,
      basis: 'assumed',
    });
  });

  it('follows the year’s BHS while the member is below 65', () => {
    // Turning 65 in 2061: in 2040 the cap is 2040's.
    const member = basicHealthcareSumForMember(CURRENT_RULE_SET, 2040, 2061);
    expect(member.fixed).toBe(false);
    expect(member.amount).toBe(basicHealthcareSumInYear(CURRENT_RULE_SET, 2040).amount);
  });

  it('fixes at the value in force in the year the member turns 65', () => {
    const atSixtyFive = basicHealthcareSumInYear(CURRENT_RULE_SET, 2061).amount;
    for (const year of [2061, 2062, 2070]) {
      const member = basicHealthcareSumForMember(CURRENT_RULE_SET, year, 2061);
      expect(member.fixed, String(year)).toBe(true);
      expect(member.amount, String(year)).toBe(atSixtyFive);
    }
    expect(basicHealthcareSumInYear(CURRENT_RULE_SET, 2070).amount).toBeGreaterThan(atSixtyFive);
  });

  it('keeps a member who turned 65 in a published year on that cohort’s figure', () => {
    // Turned 65 in 2023: $68,500 for life, whatever the year.
    expect(basicHealthcareSumForMember(CURRENT_RULE_SET, 2030, 2023)).toMatchObject({
      amount: 68_500,
      basis: 'published',
      fixed: true,
    });
  });
});

describe('assumptions for the panel', () => {
  it('lists both assumptions with the year they start, their rate, basis and source', () => {
    const assumptions = escalationAssumptions(CURRENT_RULE_SET);
    expect(assumptions.map((assumption) => assumption.id)).toEqual(['retirementSums', 'basicHealthcareSum']);
    const [retirement, healthcare] = assumptions;
    expect(retirement).toMatchObject({ appliesFrom: 2028, assumedAnnualRise: 0.035, sourceId: 'basicRetirementSum' });
    expect(healthcare).toMatchObject({ appliesFrom: 2027, assumedAnnualRise: 0.047, sourceId: 'basicHealthcareSum' });
    for (const assumption of assumptions) {
      expect(SOURCES).toHaveProperty(assumption.sourceId);
      expect(assumption.basis.length).toBeGreaterThan(40);
    }
  });
});
