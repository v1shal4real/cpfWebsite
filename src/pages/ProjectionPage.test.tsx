import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { ProjectionPage } from './ProjectionPage';
import { defaultDraft } from './projection/defaults';

/*
 * Rendered to HTML on the server side of React, which needs no browser: enough
 * to check what lands on the page and in what order. Interaction is covered by
 * the component interaction tests.
 */

const draft = defaultDraft('2026-10');
const html = renderToString(<ProjectionPage draft={draft} />);
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('landing on the projection page', () => {
  it('opens on a projection of the default inputs, with no input needed', () => {
    const outcome = projectDraft(draft);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { summary } = outcome.result;
    const total = (balances: Record<string, number>) => Object.values(balances).reduce((a, b) => a + b, 0) / 100;
    expect(text).toContain('Projected balances at 55');
    expect(text).toContain(formatMoney(total(summary.atAge55!.balances)));
    expect(text).toContain(formatMoney(total(summary.atEnd.balances)));
  });

  it('defaults to no housing plan, so no purchase is put in front of the visitor', () => {
    expect(draft.housingPlan).toBe('none');
    expect(text).toContain('Housing plan');
  });

  it('carries the rules-as-at stamp and projection framing', () => {
    expect(text).toContain('Rules as at');
    expect(text).toMatch(/projection, not advice/i);
  });

  it('puts the headline first, then the inputs, then the detail, in the document', () => {
    const headline = html.indexOf('id="headline-heading"');
    const inputs = html.indexOf('id="inputs-heading"');
    const results = html.indexOf('id="results-heading"');
    expect(headline).toBeGreaterThan(-1);
    expect(headline).toBeLessThan(inputs);
    expect(inputs).toBeLessThan(results);
  });

  it('shows a yearly balance table with the age-55 row', () => {
    expect(text).toContain('Projected account balances by age');
    expect(html).toMatch(/<th[^>]*scope="row"[^>]*>55<\/th>/);
  });

  it('explains instead of crashing when the inputs cannot be projected', () => {
    const broken = renderToString(<ProjectionPage draft={{ ...draft, monthlySalary: 10_000 }} />);
    expect(broken).toContain('This projection cannot be calculated yet');
    expect(broken).toMatch(/graduated CPF rates/);
  });
});
