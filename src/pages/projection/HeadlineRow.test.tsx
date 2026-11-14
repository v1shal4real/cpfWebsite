import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { CURRENT_RULE_SET } from '@/rules';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { HeadlineRow } from './HeadlineRow';
import { headlineFigures, retirementSumContext } from './headlineFigures';

const project = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  return outcome.result;
};

const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('retirement sum context', () => {
  it('states the gap as above or below, with the amount', () => {
    expect(retirementSumContext(250_000, 220_400, 2051)).toBe(
      '$29,600 above the Full Retirement Sum of $220,400 for members turning 55 in 2051.',
    );
    expect(retirementSumContext(200_000, 220_400, 2051)).toMatch(/^\$20,400 below/);
  });

  it('never frames the gap as good or bad', () => {
    for (const ra of [0, 100_000, 220_400, 500_000]) {
      expect(retirementSumContext(ra, 220_400, 2051)).not.toMatch(
        /good|bad|short|enough|on track|well done|warning/i,
      );
    }
  });
});

describe('headline figures', () => {
  it('uses the cohort Full Retirement Sum for the year the member turns 55', () => {
    const result = project(DEFAULT_FORM);
    const figures = headlineFigures(result);
    const month55 = result.months.find((m) => m.ageInMonths === 55 * 12)!;
    expect(figures.at55?.year).toBe(Number(month55.month.slice(0, 4)));
    expect(figures.at55?.fullRetirementSum).toBe(result.summary.atAge55!.fullRetirementSum / 100);
  });

  it('reports no accrued interest without a housing plan', () => {
    const figures = headlineFigures(project(DEFAULT_FORM));
    expect(figures.accruedInterest).toBe(0);
    expect(figures.usedCpfForHousing).toBe(false);
  });

  it('reports the accrued interest owed at the end with a housing plan', () => {
    const result = project(HDB);
    const figures = headlineFigures(result);
    expect(figures.usedCpfForHousing).toBe(true);
    expect(figures.accruedInterest).toBeGreaterThan(0);
    expect(figures.accruedInterest).toBe(result.months.at(-1)!.housing!.accruedInterest / 100);
  });
});

describe('HeadlineRow', () => {
  it('renders three tiles with source links and the rules stamp', () => {
    const result = project(HDB);
    const html = renderToString(<HeadlineRow result={result} ruleSet={CURRENT_RULE_SET} />);
    const t = text(html);
    expect(t).toContain('Projected balances at 55');
    expect(t).toContain('Retirement Account at 55');
    expect(t).toContain('Accrued interest owed if sold at 65');
    expect(t).toContain(formatMoney(headlineFigures(result).accruedInterest));
    expect(html.match(/target="_blank"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(t).toContain('Rules as at');
  });
});
