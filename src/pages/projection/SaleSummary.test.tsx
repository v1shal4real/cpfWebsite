import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { SaleSummary } from './SaleSummary';

const UPGRADE: FormValues = {
  ...DEFAULT_FORM,
  ordinaryBalance: 200_000,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 100,
  loanTenureYears: 25,
  housingGrant: 50_000,
  selling: true,
  saleAge: 40,
  salePrice: 700_000,
  nextHousingPlan: 'hdb-loan',
  nextPropertyPrice: 900_000,
  nextDownpayment: 300_000,
  nextOrdinaryAccountSharePercent: 60,
  nextLoanTenureYears: 25,
};

const render = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  const html = renderToString(<SaleSummary result={outcome.result} />);
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
};

describe('SaleSummary', () => {
  it('lists the sale in CPF Board’s order: loan, refund, cash', () => {
    const { text } = render(UPGRADE);
    const order = ['Sale price', '1. Housing loan repaid', '2. Refunded to CPF', '3. Cash proceeds'].map(
      (label) => text.indexOf(label),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).toContain('to the Ordinary Account');
    expect(text).toContain('including any grant');
  });

  it('describes the next home bought the same month', () => {
    expect(render(UPGRADE).text).toContain('The next home is bought the same month');
    expect(render({ ...UPGRADE, nextHousingPlan: 'none' }).text).not.toContain('The next home');
  });

  it('says when the price does not cover the refund, without a top-up', () => {
    const { text } = render({ ...UPGRADE, salePrice: 330_000, nextHousingPlan: 'none' });
    expect(text).toMatch(/is not covered by the price and need not be topped up/);
  });

  it('renders nothing without a sale', () => {
    expect(render({ ...UPGRADE, selling: false }).html).toBe('');
  });
});
