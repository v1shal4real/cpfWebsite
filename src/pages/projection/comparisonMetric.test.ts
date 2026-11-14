import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { combinedAt55, comparisonMetric, comparisonSentence } from './comparisonMetric';

const project = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  return outcome.result;
};

/** The same word check the framing review applies to every view. */
const VERDICT =
  /\b(should|recommend\w*|best|better|worse|good|bad|optimal|ideal|on track|enough|afford\w*|cheap\w*|lose|losing|loss|gain\w*|benefit\w*|penalt\w*|shortfall|cost\w*|save[sd]?|ahead|behind|win\w*)\b/i;

describe('comparison sentence', () => {
  it('states the difference as higher or lower in B than in A', () => {
    expect(comparisonSentence(500_000, 548_200)).toBe(
      'Combined balances at 55: $48,200 higher in scenario B than in scenario A.',
    );
    expect(comparisonSentence(548_200, 500_000)).toBe(
      'Combined balances at 55: $48,200 lower in scenario B than in scenario A.',
    );
  });

  it('says the same when the difference rounds to no dollars', () => {
    expect(comparisonSentence(500_000, 500_000.4)).toBe(
      'Combined balances at 55 are the same in both scenarios.',
    );
  });

  it('never implies a better choice, whichever way the difference goes', () => {
    for (const [a, b] of [
      [1, 2],
      [2, 1],
      [1, 1],
      [0, 1_000_000],
      [1_000_000, 0],
    ] as const) {
      expect(comparisonSentence(a, b)).not.toMatch(VERDICT);
    }
  });
});

describe('comparison metric', () => {
  it('compares combined balances at 55, B minus A', () => {
    const a = project(DEFAULT_FORM);
    const b = project({ ...DEFAULT_FORM, monthlySalary: 6_000 });
    const metric = comparisonMetric(a, b)!;
    expect(metric.a).toBe(combinedAt55(a));
    expect(metric.b).toBe(combinedAt55(b));
    expect(metric.difference).toBeGreaterThan(0);
    expect(metric.sentence).toContain('higher in scenario B');
  });

  it('moves with a housing decision', () => {
    const a = project(DEFAULT_FORM);
    const b = project({
      ...DEFAULT_FORM,
      housingPlan: 'hdb-loan',
      propertyPrice: 500_000,
      purchaseAge: 32,
      downpayment: 125_000,
      ordinaryAccountSharePercent: 100,
      loanTenureYears: 25,
    });
    expect(comparisonMetric(a, b)!.difference).toBeLessThan(0);
  });

  it('is absent when a projection ends before 55', () => {
    const young = project(DEFAULT_FORM);
    const ended = { ...young, summary: { ...young.summary, atAge55: undefined } };
    expect(comparisonMetric(young, ended)).toBeNull();
  });
});
