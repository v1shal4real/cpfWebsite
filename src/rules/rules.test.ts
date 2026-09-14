import { describe, expect, it } from 'vitest';
import {
  CURRENT_RULE_SET,
  RULE_SETS,
  SOURCES,
  bandForAge,
  resolveRuleSet,
  ruleSetById,
  sourceFor,
  type RuleSet,
} from './index';

/** Every sourced group in a rule set, by name. */
function groupsOf(set: RuleSet) {
  return {
    wageCeilings: set.wageCeilings,
    contributionRates: set.contributionRates,
    allocation: set.allocation,
    interest: set.interest,
    thresholds: set.thresholds,
    housing: set.housing,
  };
}

const eachSet = RULE_SETS.map((set) => [set.id, set] as const);

describe('rule set data integrity', () => {
  it.each(eachSet)('%s: allocation ratios in every band sum to 1', (_id, set) => {
    for (const band of set.allocation.bands) {
      const total = band.ordinary + band.specialOrRetirement + band.medisave;
      // Ratios are published to four decimal places.
      expect(total).toBeCloseTo(1, 4);
    }
  });

  it.each(eachSet)('%s: age bands ascend and end with an open band', (_id, set) => {
    for (const bands of [set.allocation.bands, set.contributionRates.bands]) {
      const bounds = bands.map((band) => band.throughAge);
      const closed = bounds.filter((bound): bound is number => bound !== null);
      expect(closed).toEqual([...closed].sort((a, b) => a - b));
      // Only the final band may be open-ended.
      expect(bounds.slice(0, -1)).not.toContain(null);
    }
    expect(set.allocation.bands.at(-1)?.throughAge).toBeNull();
  });

  it.each(eachSet)('%s: every group and field override cites a registered source', (_id, set) => {
    for (const [name, group] of Object.entries(groupsOf(set))) {
      expect(SOURCES, `${name}.sourceId`).toHaveProperty(group.sourceId);
      for (const [field, id] of Object.entries(group.fieldSources ?? {})) {
        // An override for a field the group does not have is a typo, not a source.
        expect(group, `${name}.fieldSources.${field}`).toHaveProperty(field);
        expect(SOURCES, `${name}.fieldSources.${field}`).toHaveProperty(id as string);
      }
    }
  });

  it('retirement sums keep their published ratios to the BRS', () => {
    const { basicRetirementSum, fullRetirementSum, enhancedRetirementSum } =
      CURRENT_RULE_SET.thresholds;
    // FRS is double the BRS; ERS is double the current year's FRS.
    expect(fullRetirementSum).toBe(basicRetirementSum * 2);
    expect(enhancedRetirementSum).toBe(fullRetirementSum * 2);
  });

  it.each(eachSet)('%s: the HDB concessionary rate sits 0.1 points above the OA rate', (_id, set) => {
    expect(set.housing.concessionaryLoanRate - set.interest.ordinary).toBeCloseTo(0.001, 6);
  });

  it.each(eachSet)('%s: accrued housing interest tracks the OA rate', (_id, set) => {
    expect(set.housing.accruedInterestRate).toBe(set.interest.ordinary);
  });
});

describe('source registry', () => {
  it.each(Object.entries(SOURCES))('%s is a well-formed, dated government page', (key, src) => {
    expect(src.id).toBe(key);
    expect(src.url).toMatch(/^https:\/\/(www\.)?(cpf|moh|hdb)\.gov\.sg\//);
    expect(src.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(src.retrievedOn))).toBe(false);
  });

  it('gives every page exactly one entry', () => {
    const urls = Object.values(SOURCES).map((src) => src.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('sourceFor', () => {
  const { thresholds, housing, wageCeilings } = CURRENT_RULE_SET;

  it("returns a field's own page when it has one", () => {
    expect(sourceFor(thresholds, 'basicHealthcareSum')).toBe('newsRelease2026Q1');
    expect(sourceFor(housing, 'hdbLoanRetentionCap')).toBe('housingLoanRetention');
    expect(sourceFor(wageCeilings, 'annualLimit')).toBe('annualLimit');
  });

  it("falls back to the group's page", () => {
    expect(sourceFor(thresholds, 'fullRetirementSum')).toBe(thresholds.sourceId);
    expect(sourceFor(housing, 'accruedInterestRate')).toBe(housing.sourceId);
    expect(sourceFor(housing)).toBe(housing.sourceId);
  });

  it('never attributes the Basic Healthcare Sum to a retirement sums page', () => {
    const id = sourceFor(thresholds, 'basicHealthcareSum');
    expect(SOURCES[id].title).toMatch(/Basic Healthcare Sum/);
  });
});

describe('bandForAge', () => {
  const bands = CURRENT_RULE_SET.allocation.bands;

  it('treats the upper bound as inclusive', () => {
    expect(bandForAge(bands, 35)?.throughAge).toBe(35);
    expect(bandForAge(bands, 36)?.throughAge).toBe(45);
    expect(bandForAge(bands, 55)?.throughAge).toBe(55);
    expect(bandForAge(bands, 56)?.throughAge).toBe(60);
  });

  it('falls through to the open-ended final band', () => {
    expect(bandForAge(bands, 71)?.throughAge).toBeNull();
    expect(bandForAge(bands, 95)?.throughAge).toBeNull();
  });
});

describe('resolveRuleSet', () => {
  it('returns the set in force on a date', () => {
    expect(resolveRuleSet('2026-01-01').id).toBe('sg-cpf-2026-01');
    expect(resolveRuleSet('2040-06-15').id).toBe('sg-cpf-2026-01');
  });

  it('falls back to the earliest set before any set applies', () => {
    expect(resolveRuleSet('1999-01-01').id).toBe(RULE_SETS[0]?.id);
  });

  it('looks sets up by pinned id', () => {
    expect(ruleSetById('sg-cpf-2026-01')).toBe(CURRENT_RULE_SET);
    expect(ruleSetById('does-not-exist')).toBeUndefined();
  });
});
