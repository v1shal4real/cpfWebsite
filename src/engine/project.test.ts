import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { addMonths, monthsBetween, parseMonth } from './calendar';
import { project } from './project';
import type { ProjectionInput } from './types';

const BASE_INPUT: ProjectionInput = {
  startMonth: '2026-01',
  startAge: 30,
  endAge: 65,
  openingBalances: { ordinary: 2_000_000, special: 1_000_000, medisave: 500_000, retirement: 0 },
  monthlyOrdinaryWage: 500_000,
  salaryGrowth: { rate: 0, appliedInMonth: 1 },
};

const input = (overrides: Partial<ProjectionInput> = {}): ProjectionInput => ({
  ...BASE_INPUT,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('project', () => {
  it('steps one month at a time from the start age through the end age', () => {
    const result = project(input({ startAge: 30, endAge: 65 }));
    expect(result.months).toHaveLength((65 - 30) * 12 + 1);
    expect(result.months.at(0)?.month).toBe('2026-01');
    expect(result.months.at(0)?.ageInMonths).toBe(30 * 12);
    expect(result.months.at(-1)?.ageInMonths).toBe(65 * 12);
  });

  it('advances the calendar across year boundaries', () => {
    const result = project(input({ startMonth: '2026-11', startAge: 64, endAge: 65 }));
    const stamps = result.months.map((month) => month.month);
    expect(stamps.slice(0, 4)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    for (const [index, stamp] of stamps.entries()) {
      expect(stamp).toBe(addMonths('2026-11', index));
    }
  });

  it('records the rules each month was computed under', () => {
    const result = project(input());
    for (const month of result.months) {
      expect(month.ruleSetId).toBe(CURRENT_RULE_SET.id);
    }
    // One entry per distinct rule set, which is one until a second dated set
    // is added. A projection crossing a rule change lists both, in order.
    expect(result.ruleSetIds).toEqual([CURRENT_RULE_SET.id]);
  });

  it('is pure: the same input always produces an identical result', () => {
    const first = project(input());
    const second = project(input());
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('does not mutate the input it was given', () => {
    const given = input();
    const snapshot = structuredClone(given);
    const result = project(given);
    expect(given).toEqual(snapshot);
    // Balances in the result must not alias the caller's object either.
    expect(result.months.at(0)?.openingBalances).not.toBe(given.openingBalances);
  });

  it('gives the same result whatever the system clock says', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const early = project(input());
    vi.setSystemTime(new Date('2071-06-30T23:59:59Z'));
    const late = project(input());
    expect(late).toEqual(early);
  });

  it('never reads the clock', () => {
    const now = vi.spyOn(Date, 'now');
    project(input());
    expect(now).not.toHaveBeenCalled();
  });
});

describe('salary growth', () => {
  const wagesByMonth = (given: ProjectionInput) =>
    project(given).months.map((month) => ({ month: month.month, wage: month.ordinaryWage }));

  it('holds the wage flat when growth is zero', () => {
    const wages = wagesByMonth(input({ salaryGrowth: { rate: 0, appliedInMonth: 1 } }));
    expect(new Set(wages.map((entry) => entry.wage))).toEqual(new Set([500_000]));
  });

  it('applies the raise once a year, in the stated month', () => {
    const wages = wagesByMonth(
      input({ startAge: 30, endAge: 33, salaryGrowth: { rate: 0.03, appliedInMonth: 4 } }),
    );
    const raises = wages.filter((entry, index) => index > 0 && entry.wage !== wages[index - 1]?.wage);
    // The projection ends in 2029-01, before that year's raise month.
    expect(raises.map((entry) => entry.month)).toEqual(['2026-04', '2027-04', '2028-04']);
    // 3% a year, compounding, rounded to the cent each time.
    expect(raises.map((entry) => entry.wage)).toEqual([515_000, 530_450, 546_364]);
  });

  it('does not raise the wage in the first month, even when it is the raise month', () => {
    const wages = wagesByMonth(
      input({ startMonth: '2026-04', salaryGrowth: { rate: 0.03, appliedInMonth: 4 } }),
    );
    expect(wages.at(0)).toEqual({ month: '2026-04', wage: 500_000 });
    // The first raise lands a year after the projection starts.
    expect(wages.at(12)).toEqual({ month: '2027-04', wage: 515_000 });
  });
});

describe('summary', () => {
  it('reports the closing position and the figures at 55', () => {
    const result = project(input({ startAge: 30, endAge: 65 }));
    expect(result.summary.atEnd.balances).toEqual(result.months.at(-1)?.closingBalances);
    expect(result.summary.atAge55?.basicRetirementSum).toBe(
      CURRENT_RULE_SET.thresholds.basicRetirementSum * 100,
    );
    expect(result.summary.atAge55?.fullRetirementSum).toBe(
      CURRENT_RULE_SET.thresholds.fullRetirementSum * 100,
    );
  });

  it('omits the figures at 55 when the projection never reaches it', () => {
    const result = project(input({ startAge: 30, endAge: 40 }));
    expect(result.summary.atAge55).toBeUndefined();
  });
});

describe('engine purity', () => {
  it('never mentions Date or performance outside its comments', () => {
    // The strongest guarantee available: the engine cannot read a clock it
    // never names. Calendar arithmetic is integer maths on YYYY-MM stamps.
    // Comments are stripped first, since they discuss the very thing being
    // banned. The stripping is naive, which is safe here because no engine
    // source holds a string containing a comment marker.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const root = join(process.cwd(), 'src', 'engine');
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const source = stripComments(readFileSync(path, 'utf8'));
          if (/\bDate\b|\bperformance\b/.test(source)) offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('calendar', () => {
  it('steps forwards and backwards across year boundaries', () => {
    expect(addMonths('2026-01', 0)).toBe('2026-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
    expect(addMonths('2026-01', 421)).toBe('2061-02');
  });

  it('measures whole months between stamps', () => {
    expect(monthsBetween('2026-01', '2026-01')).toBe(0);
    expect(monthsBetween('2026-01', '2027-01')).toBe(12);
    expect(monthsBetween('2027-01', '2026-11')).toBe(-2);
  });

  it('rejects a malformed stamp', () => {
    expect(() => parseMonth('2026-13')).toThrow(RangeError);
    expect(() => parseMonth('2026-1')).toThrow(RangeError);
    expect(() => parseMonth('not-a-month')).toThrow(RangeError);
  });
});
