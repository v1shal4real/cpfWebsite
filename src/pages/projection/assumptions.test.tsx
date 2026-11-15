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
    const expected = Object.keys(CURRENT_RULE_SET).filter(
      (key) => !META.has(key) && !SHOWN_AS_ASSUMPTIONS.has(key),
    );
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
      const group = CURRENT_RULE_SET[key as keyof RuleSet] as {
        sourceId: SourceId;
        fieldSources?: Record<string, SourceId>;
      };
      for (const id of Object.values(group.fieldSources ?? {})) {
        if (id !== group.sourceId) expect(linked, `${key} → ${id}`).toContain(id);
      }
    }
  });

  it('shows one row per contribution and allocation band', () => {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId.contributionRates!.rows).toHaveLength(CURRENT_RULE_SET.contributionRates.bands.length + 1);
    expect(byId.allocation!.rows).toHaveLength(CURRENT_RULE_SET.allocation.bands.length);
    expect(byId.contributionRates!.rows[0]).toEqual({
      label: 'Age 55 and below',
      value: '20% employee + 17% employer',
    });
  });
});

describe('assumptions group', () => {
  it('states salary growth and both escalation assumptions with their sources', () => {
    const group = assumptionGroup(project(DEFAULT_FORM).input, CURRENT_RULE_SET);
    expect(group.rows[0]).toMatchObject({
      label: 'Salary growth (yours)',
      value: 'None: salary stays as it is today',
    });
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
    // A projection from October 2026 runs under both sets: the 2026 one now
    // closed, the 2027 one open-ended.
    expect(html).toContain('1 January 2026 to 31 December 2026');
    expect(html).toContain('From 1 January 2027');
  });

  it('shows every rule set when a projection spans more than one, oldest first, each with its own figures', () => {
    expect(result.ruleSetIds).toEqual(['sg-cpf-2026-01', 'sg-cpf-2027-01']);
    const text = renderToString(<AssumptionsPanel result={result} />)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    expect(text).toContain('This projection uses 2 rule sets');
    expect(text).toContain(
      '1 January 2026 (1 January 2026 to 31 December 2026), then 1 January 2027 (from 1 January 2027)',
    );
    const at2026 = text.indexOf('CPF rules as at 1 January 2026');
    const at2027 = text.indexOf('CPF rules as at 1 January 2027');
    expect(at2026).toBeGreaterThan(-1);
    expect(at2027).toBeGreaterThan(at2026);
    // Above 55 to 60: 34% in 2026, 35.5% in 2027, each under its own set.
    expect(text.slice(at2026, at2027)).toContain('Age above 55 to 60 18% employee + 16% employer');
    expect(text.slice(at2027)).toContain('Age above 55 to 60 19% employee + 16.5% employer');
    expect(text.slice(at2027)).toContain('$228,200');
  });

  it('shows one rule set for a link pinned to 2026', () => {
    const pinned = projectDraft({ ...toDraft(DEFAULT_FORM, '2026-10'), rulesAsAt: 'sg-cpf-2026-01' });
    if (!pinned.ok) throw new Error('should project');
    const html = renderToString(<AssumptionsPanel result={pinned.result} />);
    expect(html).not.toContain('rule sets');
    expect(html).not.toContain('CPF rules as at 1 January 2027');
  });
});
