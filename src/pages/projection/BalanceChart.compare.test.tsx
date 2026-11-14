import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoneyDelta } from '@/lib/format';
import { BALANCE_SERIES } from '@/theme/series';
import { BalanceChart } from './BalanceChart';
import { comparisonPoints, yearlyRows } from './balanceData';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';

const project = (form: FormValues) => {
  const outcome = projectDraft(toDraft(form, '2026-10'));
  if (!outcome.ok) throw new Error('should project');
  return outcome.result;
};

const resultA = project(DEFAULT_FORM);
const resultB = project({
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 100,
  loanTenureYears: 25,
});

describe('comparison points', () => {
  it('carries A under the account keys and B under b_ keys, one point per age', () => {
    const points = comparisonPoints(yearlyRows(resultA), yearlyRows(resultB));
    expect(points).toHaveLength(yearlyRows(resultA).length);
    const at40 = points.find((p) => p.age === 40)! as Record<string, unknown>;
    for (const key of BALANCE_SERIES) {
      expect(at40).toHaveProperty(key);
      expect(at40).toHaveProperty(`b_${key}`);
    }
    expect(at40.b_oa).not.toBe(at40.oa);
  });
});

describe('BalanceChart with two scenarios', () => {
  const html = renderToString(<BalanceChart result={resultA} compare={{ resultA, resultB }} />);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('adds no new hue: only registry colours and ink', () => {
    expect(html.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
  });

  it('has a legend for scenario as well as account', () => {
    expect(text).toContain('Scenario A: solid');
    expect(text).toContain('Scenario B: dashed');
    expect(text).toContain('Ordinary Account');
    expect(text).toContain('dashed lines in the same account colours');
  });

  it('tables both scenarios and the difference in the total', () => {
    expect(text).toContain('Difference in total, B − A');
    const a55 = yearlyRows(resultA).find((r) => r.age === 55)!;
    const b55 = yearlyRows(resultB).find((r) => r.age === 55)!;
    expect(text).toContain(formatMoneyDelta(b55.total - a55.total));
    // Age, five A/B pairs and the difference: 12 cells in a body row.
    const row = html.match(/<tr[^>]*data-highlighted="true"[^>]*>([\s\S]*?)<\/tr>/)![1]!;
    expect(row.match(/<t[dh]\b/g)).toHaveLength(12);
  });

  it('keeps the single-scenario table without a comparison', () => {
    const single = renderToString(<BalanceChart result={resultA} />);
    expect(single).not.toContain('Difference in total');
    expect(single).not.toContain('Scenario B: dashed');
  });
});
