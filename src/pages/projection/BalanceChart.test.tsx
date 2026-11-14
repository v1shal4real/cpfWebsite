import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { formatMoney } from '@/lib/format';
import { DEFAULT_FORM, toDraft } from './form';
import { BalanceChart } from './BalanceChart';
import { AGE_55, chartPoints, yearlyRows } from './balanceData';

const outcome = projectDraft(toDraft(DEFAULT_FORM, '2026-10'));
if (!outcome.ok) throw new Error('default form should project');
const result = outcome.result;

describe('yearly balance rows', () => {
  const rows = yearlyRows(result);

  it('has one row per year of age, start to end', () => {
    const ages = rows.map((row) => row.age);
    expect(ages[0]).toBe(result.input.startAge);
    expect(ages.at(-1)).toBe(result.input.endAge);
    expect(ages.every((age, i) => i === 0 || age === ages[i - 1]! + 1)).toBe(true);
  });

  it('totals each row from its four accounts', () => {
    for (const { balances, total } of rows) {
      expect(total).toBeCloseTo(balances.ordinary + balances.special + balances.medisave + balances.retirement, 6);
    }
  });
});

describe('chart points', () => {
  const points = chartPoints(yearlyRows(result));

  it('draws the Special Account only before 55 and the Retirement Account only from 55', () => {
    for (const point of points) {
      if (point.age < AGE_55) {
        expect(point.ra).toBeNull();
        expect(typeof point.sa).toBe('number');
      } else {
        expect(point.sa).toBeNull();
        expect(typeof point.ra).toBe('number');
      }
    }
  });
});

describe('BalanceChart', () => {
  const html = renderToString(<BalanceChart result={result} />);

  it('uses registry colours only', () => {
    const hex = html.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(hex).toEqual([]);
  });

  it('renders the screen-reader table while the chart shows, with the 55 row highlighted', () => {
    expect(html).toContain('Projected account balances by age');
    expect(html).toMatch(/<tr[^>]*data-highlighted="true"[^>]*><th[^>]*scope="row"[^>]*>55<\/th>/);
    const at55 = yearlyRows(result).find((row) => row.age === AGE_55)!;
    expect(html).toContain(formatMoney(at55.total));
  });

  it('says the age-55 transition in its summary', () => {
    expect(html).toContain('At 55 the Special Account closes and the Retirement Account opens.');
  });
});
