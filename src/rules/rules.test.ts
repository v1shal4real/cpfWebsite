import { describe, expect, it } from 'vitest';
import {
  CURRENT_RULE_SET,
  RULE_SETS,
  SOURCES,
  bandForAge,
  resolveRuleSet,
  ruleSetById,
} from './index';

describe('rule set data integrity', () => {
  it.each(RULE_SETS.map((set) => [set.id, set] as const))(
    '%s: allocation ratios in every band sum to 1',
    (_id, set) => {
      for (const band of set.allocation.bands) {
        const total = band.ordinary + band.specialOrRetirement + band.medisave;
        // Ratios are published to four decimal places.
        expect(total).toBeCloseTo(1, 4);
      }
    },
  );

  it.each(RULE_SETS.map((set) => [set.id, set] as const))(
    '%s: age bands ascend and end with an open band',
    (_id, set) => {
      for (const bands of [set.allocation.bands, set.contributionRates.bands]) {
        const bounds = bands.map((band) => band.throughAge);
        const closed = bounds.filter((bound): bound is number => bound !== null);
        expect(closed).toEqual([...closed].sort((a, b) => a - b));
        // Only the final band may be open-ended.
        expect(bounds.slice(0, -1)).not.toContain(null);
      }
      expect(set.allocation.bands.at(-1)?.throughAge).toBeNull();
    },
  );

  it.each(RULE_SETS.map((set) => [set.id, set] as const))(
    '%s: every parameter group cites a registered source',
    (_id, set) => {
      const groups = [
        set.wageCeilings,
        set.contributionRates,
        set.allocation,
        set.interest,
        set.thresholds,
        set.housing,
      ];
      for (const group of groups) {
        expect(SOURCES).toHaveProperty(group.sourceId);
      }
    },
  );

  it('retirement sums keep their published ratios to the BRS', () => {
    const { basicRetirementSum, fullRetirementSum, enhancedRetirementSum } =
      CURRENT_RULE_SET.thresholds;
    expect(fullRetirementSum).toBe(basicRetirementSum * 2);
    expect(enhancedRetirementSum).toBe(basicRetirementSum * 4);
  });

  it('the HDB concessionary rate sits 0.1 points above the OA rate', () => {
    const { housing, interest } = CURRENT_RULE_SET;
    expect(housing.concessionaryLoanRate - interest.ordinary).toBeCloseTo(0.001, 6);
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
