import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { CURRENT_RULE_SET } from '@/rules';
import { DEFAULT_FORM, type FormValues } from './form';
import type { Scenarios } from './scenarios';

const START = '2026-10';
const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 100,
  loanTenureYears: 25,
};

const render = (scenarios: Scenarios) => {
  const html = renderToString(<ProjectionPage startMonth={START} initialScenarios={scenarios} />);
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
};

describe('side-by-side comparison', () => {
  const { html, text } = render({ a: DEFAULT_FORM, b: HDB, active: 'b' });

  it('leads with a single difference statement', () => {
    const statements = text.match(/Combined balances at 55: \$[\d,]+ (higher|lower) in scenario B than in scenario A\./g);
    expect(statements).toHaveLength(1);
    // Before either scenario's figures.
    expect(text.indexOf(statements![0]!)).toBeLessThan(text.indexOf('Scenario A '));
  });

  it('shows both scenarios, each with the rules-as-at stamp', () => {
    const columns = [...html.matchAll(/<section aria-label="Scenario (A|B)"[\s\S]*?<\/section>/g)].map((m) => m[0]);
    expect(columns).toHaveLength(2);
    for (const column of columns) expect(column).toContain(`Rules as at`);
    expect(text).toContain(CURRENT_RULE_SET.label);
  });

  it('marks only which scenario is being edited, and labels the detail below', () => {
    expect(text.match(/Editing/g)).toHaveLength(1);
    expect(text).toContain('Detail for Scenario B, the scenario being edited');
  });

  it('stacks below the sm breakpoint and sits side by side above it', () => {
    expect(html).toContain('grid grid-cols-1 gap-3 sm:grid-cols-2');
  });

  it('keeps the single-scenario headline when there is no B', () => {
    const single = render({ a: DEFAULT_FORM, b: null, active: 'a' }).text;
    expect(single).not.toContain('in scenario B than in scenario A');
    expect(single).toContain('Projected balances at 55');
  });

  it('says the same when B matches A', () => {
    expect(render({ a: HDB, b: HDB, active: 'a' }).text).toContain('Combined balances at 55 are the same in both scenarios.');
  });
});
