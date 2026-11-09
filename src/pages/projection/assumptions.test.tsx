import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { CURRENT_RULE_SET, source, type RuleSet, type SourceId } from '@/rules';
import { AssumptionsPanel } from './AssumptionsPanel';
import { assumptionGroup, ruleSetGroups } from './assumptions';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';

const project = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  return outcome.result;
};

const META = new Set(['id', 'label', 'effectiveFrom', 'effectiveTo', 'verified']);
// Escalation is shown in the Assumptions group, not as a rule-set group.
const SHOWN_AS_ASSUMPTIONS = new Set(['escalation']);

describe('rule-set groups', () => {
  const groups = ruleSetGroups(CURRENT_RULE_SET);

  it('has a group for every parameter group in the rule set', () => {
    const expected = Object.keys(CURRENT_RULE_SET).filter((key) => !META.has(key) && !SHOWN_AS_ASSUMPTIONS.has(key));
    expect(groups.map((g) => g.id).sort()).toEqual(expected.sort());
  });

  it('links every group to its source page', () => {
    for (const group of groups) {
      const ruleGroup = CURRENT_RULE_SET[group.id as keyof RuleSet] as { sourceId: SourceId };
      expect(group.sourceId).toBe(ruleGroup.sourceId);
    }
  });

  it('links every per-field source the rule set declares', () => {
    const linked = new Set(groups.flatMap((g) => g.rows.map((r) => r.sourceId)).filter(Boolean));
    for (const key of Object.keys(CURRENT_RULE_SET)) {
      if (META.has(key) || SHOWN_AS_ASSUMPTIONS.has(key)) continue;
      const group = CURRENT_RULE_SET[key as keyof RuleSet] as { sourceId: SourceId; fieldSources?: Record<string, SourceId> };
      for (const id of Object.values(group.fieldSources ?? {})) {
        if (id !== group.sourceId) expect(linked, `${key} → ${id}`).toContain(id);
      }
    }
  });

  it('shows one row per contribution and allocation band', () => {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.contributionRates!.rows).toHaveLength(CURRENT_RULE_SET.contributionRates.bands.length + 1);
    expect(byId.allocation!.rows).toHaveLength(CURRENT_RULE_SET.allocation.bands.length);
    expect(byId.contributionRates!.rows[0]).toEqual({ label: 'Age 55 and below', value: '20% employee + 17% employer' });
  });
});

describe('assumptions group', () => {
  it('states salary growth and both escalation assumptions with their sources', () => {
    const group = assumptionGroup(project(DEFAULT_FORM).input, CURRENT_RULE_SET);
    expect(group.rows[0]).toMatchObject({ label: 'Salary growth (yours)', value: 'None: salary stays as it is today' });
    expect(group.rows.filter((r) => r.value.includes('(assumed)'))).toHaveLength(2);
    expect(group.rows.filter((r) => r.value.includes('(assumed)')).every((r) => r.sourceId)).toBe(true);
  });

  it('includes the bank loan rate when there is one', () => {
    const result = project({
      ...DEFAULT_FORM,
      housingPlan: 'bank-loan',
      propertyPrice: 500_000,
      purchaseAge: 32,
      downpayment: 125_000,
      ordinaryAccountSharePercent: 75,
      loanTenureYears: 25,
      bankLoanRatePercent: 3,
    });
    expect(assumptionGroup(result.input, CURRENT_RULE_SET).rows).toContainEqual(
      expect.objectContaining({ label: 'Bank loan rate (yours)', value: '3% a year, for the whole tenure' }),
    );
  });
});

describe('AssumptionsPanel', () => {
  const result = project(DEFAULT_FORM);

  it('is visible by default and links its sources', () => {
    const html = renderToString(<AssumptionsPanel result={result} />);
    expect(html).toContain('Assumptions and sources');
    expect(html).not.toMatch(/<details/);
    expect(html).toContain(source(CURRENT_RULE_SET.contributionRates.sourceId).url.replace(/&/g, '&amp;'));
    expect(html).toContain('From 1 January 2026');
  });

  it('shows every rule set when a projection spans more than one', () => {
    // Only one rule set exists today, so the same id twice stands in for a span.
    const spanning = { ...result, ruleSetIds: [CURRENT_RULE_SET.id, CURRENT_RULE_SET.id] };
    const html = renderToString(<AssumptionsPanel result={spanning} />);
    expect(html).toContain('This projection uses 2 rule sets');
    expect(html.match(/CPF rules as at 1 January 2026/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
