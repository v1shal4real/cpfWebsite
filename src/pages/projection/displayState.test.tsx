import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { DEFAULT_DISPLAY, DEFAULT_INFLATION_PERCENT, decodeDisplay, encodeDisplay } from './displayState';
import { DEFAULT_FORM, toDraft } from './form';
import { inRealTerms } from './realTerms';

const encoded = (realTerms: boolean, inflationPercent: number) => {
  const params = new URLSearchParams();
  encodeDisplay({ realTerms, inflationPercent }, params);
  return params.toString();
};

describe('display settings in the link', () => {
  it('writes nothing when nominal, so existing links are unchanged', () => {
    expect(encoded(false, 3)).toBe('');
    expect(decodeDisplay('?v=1&a=30')).toEqual(DEFAULT_DISPLAY);
  });

  it('round-trips today’s dollars and the rate', () => {
    expect(decodeDisplay(`?${encoded(true, 2.5)}`)).toEqual({ realTerms: true, inflationPercent: 2.5 });
  });

  it('falls back to the default rate for one it cannot use', () => {
    for (const bad of ['abc', '-1', '50', '']) {
      expect(decodeDisplay(`?real=1&inf=${bad}`).inflationPercent).toBe(DEFAULT_INFLATION_PERCENT);
    }
    expect(decodeDisplay('?real=1').inflationPercent).toBe(DEFAULT_INFLATION_PERCENT);
  });

  it('defaults to MAS Core Inflation’s historical mean, 1.7%', () => {
    expect(DEFAULT_INFLATION_PERCENT).toBe(1.7);
  });
});

describe('the page in today’s dollars', () => {
  const outcome = projectDraft(toDraft(DEFAULT_FORM, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  const text = (realTerms: boolean) =>
    renderToString(
      <ProjectionPage startMonth="2026-10" initialDisplay={{ realTerms, inflationPercent: 1.7 }} />,
    )
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/\s+/g, ' ');

  it('says which dollars the figures are in, and shows the inflation rate it uses', () => {
    expect(text(false)).toContain("Figures in each year's own dollars, not adjusted for inflation.");
    const real = text(true);
    expect(real).toContain("Figures in today's dollars, at 1.7% inflation a year.");
    expect(real).toContain('Inflation a year');
    expect(real).toContain('Inflation (yours)');
  });

  it('restates the headline, the chart table and CPF LIFE in today’s dollars', () => {
    const realResult = inRealTerms(outcome.result, 0.017);
    const at55 = (r: typeof realResult) => {
      const b = r.summary.atAge55!.balances;
      return formatMoney((b.ordinary + b.special + b.medisave + b.retirement) / 100);
    };
    const real = text(true);
    expect(real).toContain(at55(realResult));
    expect(real).not.toContain(at55(outcome.result));
    expect(real).toContain(formatMoney(realResult.summary.cpfLife!.standardFrom65 / 100));
    expect(real).toContain("in today's dollars it falls as prices rise");
  });
});
