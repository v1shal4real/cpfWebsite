import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { ProjectionPage } from './ProjectionPage';
import { DEFAULT_FORM, toDraft, type FormValues } from './projection/form';

/*
 * Rendered to HTML on the server side of React, which needs no browser: enough
 * to check what lands on the page, in what order, and which fields show.
 * Typing into fields is covered by the component interaction tests.
 */

const START = '2026-10';
const render = (initialForm: FormValues = DEFAULT_FORM) => {
  const html = renderToString(<ProjectionPage startMonth={START} initialForm={initialForm} />);
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
};

const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 100_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
};

describe('landing on the projection page', () => {
  const { html, text } = render();

  it('opens on a projection of the default inputs, with no input needed', () => {
    const outcome = projectDraft(toDraft(DEFAULT_FORM, START));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { summary } = outcome.result;
    const total = (balances: Record<string, number>) => Object.values(balances).reduce((a, b) => a + b, 0) / 100;
    expect(text).toContain('Projected balances at 55');
    expect(text).toContain(formatMoney(total(summary.atAge55!.balances)));
    expect(text).toContain(formatMoney(total(summary.atEnd.balances)));
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
});

describe('the input panel', () => {
  it('asks for every §3.1 input that applies without a housing plan', () => {
    const { text } = render();
    for (const label of [
      'Current age',
      'Gross monthly salary',
      'Expected salary growth a year',
      'Ordinary Account',
      'Special Account',
      'MediSave Account',
      'Housing plan',
    ]) {
      expect(text, label).toContain(label);
    }
  });

  it('states the salary growth default and what it assumes in the hint', () => {
    const { text } = render();
    expect(DEFAULT_FORM.salaryGrowthPercent).toBe(0);
    expect(text).toContain('Default 0%: assumes your salary stays as it is today.');
  });

  it('hides every housing field until a housing plan is selected', () => {
    const { text } = render();
    for (const label of ['Property price', 'Age at purchase', 'Downpayment', 'Loan tenure', 'Bank loan interest rate']) {
      expect(text, label).not.toContain(label);
    }
  });

  it('shows the housing fields for an HDB loan, without a rate', () => {
    const { text } = render(HDB);
    for (const label of ['Property price', 'Age at purchase', 'Downpayment', 'Share of the downpayment from the Ordinary Account', 'Loan tenure']) {
      expect(text, label).toContain(label);
    }
    expect(text).not.toContain('Bank loan interest rate');
    expect(text).toContain('Up to 25 years for an HDB loan.');
  });

  it('adds the rate for a bank loan, with its longer tenure', () => {
    const { text } = render({ ...HDB, housingPlan: 'bank-loan', loanTenureYears: 30, bankLoanRatePercent: 3 });
    expect(text).toContain('Bank loan interest rate');
    expect(text).toContain('Up to 35 years for a bank loan.');
  });

  it('includes the housing plan in the projection once its fields are complete', () => {
    const { text } = render(HDB);
    expect(text).not.toContain('cannot be calculated');
    expect(text).not.toContain('last complete projection');
  });
});

describe('validation errors', () => {
  it('shows an engine guard error beside its field, as an alert linked to the control', () => {
    const { html } = render({ ...DEFAULT_FORM, monthlySalary: 100 });
    const salaryField = html.slice(html.indexOf('Gross monthly salary'), html.indexOf('Expected salary growth'));
    expect(salaryField).toMatch(/role="alert"[^>]*>.*graduated CPF rates/);
    expect(salaryField).toMatch(/aria-invalid="true"/);
  });

  it('holds back a "required" message until the visitor has been to the field', () => {
    // Selecting a plan leaves the housing fields empty; that is not yet an error to shout about.
    const { html, text } = render({ ...DEFAULT_FORM, housingPlan: 'hdb-loan' });
    const priceField = html.slice(html.indexOf('Property price'), html.indexOf('Age at purchase'));
    expect(priceField).not.toContain('role="alert"');
    // But the summary says what is missing, so the visitor is never left guessing.
    expect(text).toContain('Property price is needed for the projection.');
  });

  it('explains instead of crashing when nothing can be projected', () => {
    const { text } = render({ ...DEFAULT_FORM, monthlySalary: 100 });
    expect(text).toContain('This projection cannot be calculated yet');
    expect(text).toMatch(/graduated CPF rates/);
  });
});
