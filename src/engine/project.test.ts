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

describe('contributions through the loop', () => {
  it('computes a contribution for every month and totals them', () => {
    const result = project(input({ startAge: 30, endAge: 31 }));
    const monthly = result.months.at(0)?.contribution;
    // $5,000 a month at 37%, of which the employee pays 20%.
    expect(monthly?.ordinaryWageSubjectToCpf).toBe(500_000);
    expect(monthly?.total).toBe(185_000);
    expect(monthly?.employee).toBe(100_000);
    expect(result.summary.totals.contributions).toBe(185_000 * result.months.length);
  });

  it('caps a high earner at the Ordinary Wage ceiling every month', () => {
    const ceiling = CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling * 100;
    const result = project(input({ monthlyOrdinaryWage: 2_000_000, startAge: 30, endAge: 31 }));
    for (const month of result.months) {
      expect(month.contribution.ordinaryWageSubjectToCpf).toBe(ceiling);
      expect(month.contribution.total).toBe(296_000);
    }
  });

  it('applies the age band from the month after the 55th birthday', () => {
    const result = project(input({ startMonth: '2026-06', startAge: 55, endAge: 56 }));
    const [birthdayMonth, monthAfter] = result.months;
    // 37% in June, 34% from July.
    expect(birthdayMonth?.contribution.total).toBe(185_000);
    expect(monthAfter?.contribution.total).toBe(170_000);
  });

  it('raises contributions with the wage', () => {
    const result = project(
      input({ startAge: 30, endAge: 31, salaryGrowth: { rate: 0.1, appliedInMonth: 1 } }),
    );
    const before = result.months.find((month) => month.month === '2026-12');
    const after = result.months.find((month) => month.month === '2027-01');
    expect(before?.contribution.total).toBe(185_000);
    // $5,500 a month at 37% = $2,035.
    expect(after?.contribution.total).toBe(203_500);
  });

  it('counts the annual ceilings per calendar year, not per projection year', () => {
    // A wage at the ceiling for a whole year uses $96,000 of the $102,000
    // annual allowance, so nothing is ever curtailed and January starts fresh.
    const ceiling = CURRENT_RULE_SET.wageCeilings.ordinaryWageCeiling * 100;
    const result = project(input({ monthlyOrdinaryWage: ceiling, startAge: 30, endAge: 33 }));
    const januaries = result.months.filter((month) => month.month.endsWith('-01'));
    expect(januaries.length).toBeGreaterThan(1);
    for (const month of result.months) {
      expect(month.contribution.ordinaryWageSubjectToCpf).toBe(ceiling);
    }
  });
});

describe('allocation through the loop', () => {
  it('credits each month exactly its contribution, split by account', () => {
    const result = project(input({ startAge: 30, endAge: 32 }));
    for (const month of result.months) {
      const { allocation, total } = month.contribution;
      expect(allocation.ordinary + allocation.special + allocation.medisave + allocation.retirement).toBe(total);
      for (const account of ['ordinary', 'special', 'medisave', 'retirement'] as const) {
        // Interest is the only other movement so far, and lands in December.
        expect(month.closingBalances[account] - month.openingBalances[account]).toBe(
          allocation[account] + month.interest.credited[account],
        );
      }
    }
  });

  it('allocates $1,850 at 30 as MediSave, then Special, then the rest to Ordinary', () => {
    const [first] = project(input({ startAge: 30, endAge: 31 })).months;
    // $1,850 x 21.62% = $399.97, x 16.21% = $299.885, which rounds up.
    expect(first?.contribution.allocation).toEqual({
      medisave: 39_997,
      special: 29_989,
      ordinary: 185_000 - 39_997 - 29_989,
      retirement: 0,
    });
  });

  it('routes the second share to Ordinary once the Retirement Account holds the FRS', () => {
    const fullRetirementSum = CURRENT_RULE_SET.thresholds.fullRetirementSum * 100;
    const result = project(
      input({
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: fullRetirementSum },
      }),
    );
    for (const month of result.months) {
      expect(month.contribution.allocation.retirement).toBe(0);
      expect(month.contribution.allocation.special).toBe(0);
      // Interest may take the Retirement Account past the sum; contributions may not.
      expect(month.closingBalances.retirement - month.openingBalances.retirement).toBe(
        month.interest.credited.retirement,
      );
    }
  });
});

describe('interest through the loop', () => {
  const ACCOUNTS = ['ordinary', 'special', 'medisave', 'retirement'] as const;
  const { interest: rates } = CURRENT_RULE_SET;

  it('accrues on each month’s opening balance, so a contribution earns from the next month', () => {
    const result = project(input({ startAge: 30, endAge: 31 }));
    for (const month of result.months) {
      for (const account of ACCOUNTS) {
        // A month reports the change in the rounded year-to-date figure, so it
        // is within a cent of the exact twelfth of the annual rate.
        const exact = (month.openingBalances[account] * rates[account]) / 12;
        expect(Math.abs(month.interest.baseAccrued[account] - exact)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('credits the year’s interest in December only, and it compounds from January', () => {
    const result = project(input({ startMonth: '2026-01', startAge: 30, endAge: 32 }));
    const byYear = new Map<string, number>();
    for (const month of result.months) {
      const year = month.month.slice(0, 4);
      const credited = ACCOUNTS.reduce((sum, account) => sum + month.interest.credited[account], 0);
      if (!month.month.endsWith('-12')) {
        expect(credited, month.month).toBe(0);
        continue;
      }
      // Base interest on each account plus extra interest by where it lands.
      const accrued = result.months
        .filter((each) => each.month.startsWith(year))
        .reduce(
          (sum, each) =>
            sum +
            ACCOUNTS.reduce(
              (s, a) => s + each.interest.baseAccrued[a] + each.interest.extraAccruedTo[a],
              0,
            ),
          0,
        );
      expect(credited, month.month).toBe(accrued);
      byYear.set(year, credited);
    }
    expect(byYear.size).toBe(2);
    // January's opening balance includes December's credit, so it earns on it.
    const january = result.months.find((month) => month.month === '2027-01');
    const december = result.months.find((month) => month.month === '2026-12');
    expect(january?.openingBalances).toEqual(december?.closingBalances);
  });

  it('matches a hand computation for the first year of a projection', () => {
    // Opening OA $20,000, SA $10,000 and MA $5,000, each receiving its share of
    // $1,850 every month. Combined balances stay under the $60,000 tier all
    // year, and OA stays at or above its $20,000 cap, so the tier counts
    // $20,000 of OA plus all of SA and MA.
    const result = project(input({ startMonth: '2026-01', startAge: 30, endAge: 31 }));
    const december = result.months.find((month) => month.month === '2026-12')!;
    const share = result.months[0]!.contribution.allocation.special;
    const [tier] = rates.extraTiersBelow55;
    const cap = rates.ordinaryAccountExtraInterestCap * 100;
    // Month m (1-12) earns on the opening balance plus (m - 1) shares.
    let base = 0;
    let extraToSpecial = 0;
    for (let m = 1; m <= 12; m++) {
      const special = 1_000_000 + (m - 1) * share;
      base += (special * rates.special) / 12;
      // SA keeps its own extra interest and receives the OA's.
      extraToSpecial += ((special + cap) * tier!.rate) / 12;
    }
    expect(december.interest.credited.special).toBe(Math.round(base) + Math.round(extraToSpecial));
  });

  it('credits only the months covered when the projection starts mid-year', () => {
    const result = project(input({ startMonth: '2026-10', startAge: 30, endAge: 31 }));
    const december = result.months.find((month) => month.month === '2026-12')!;
    const covered = result.months.filter((month) => month.month <= '2026-12');
    expect(covered).toHaveLength(3);
    // OA is credited only its own base interest; its extra interest goes to SA.
    expect(december.interest.credited.ordinary).toBe(
      covered.reduce((sum, month) => sum + month.interest.baseAccrued.ordinary, 0),
    );
  });

  it('never credits extra interest to the Ordinary Account', () => {
    for (const startAge of [30, 57]) {
      for (const month of project(input({ startAge, endAge: startAge + 2 })).months) {
        expect(month.interest.extraAccruedOn.ordinary).toBeGreaterThan(0);
        expect(month.interest.extraAccruedTo.ordinary).toBe(0);
      }
    }
  });

  it('routes the Ordinary Account’s extra interest to SA below 55 and RA from 55', () => {
    const below = project(input({ startAge: 30, endAge: 31 })).months[0]!;
    // OA is at its $20,000 cap: 1% a year on it, a twelfth a month.
    expect(below.interest.extraAccruedOn.ordinary).toBe(1_667);
    expect(below.interest.extraAccruedTo.special).toBe(
      below.interest.extraAccruedOn.special + below.interest.extraAccruedOn.ordinary,
    );

    const above = project(
      input({
        startAge: 57,
        endAge: 58,
        openingBalances: { ordinary: 2_000_000, special: 0, medisave: 500_000, retirement: 1_000_000 },
      }),
    ).months[0]!;
    expect(above.interest.extraAccruedTo.retirement).toBe(
      above.interest.extraAccruedOn.retirement + above.interest.extraAccruedOn.ordinary,
    );
    expect(above.interest.extraAccruedTo.special).toBe(0);
  });

  it('earns less extra interest when the Ordinary Account holds under $20,000', () => {
    const firstYearExtra = (ordinary: number) => {
      const openingBalances = { ordinary, special: 1_000_000, medisave: 500_000, retirement: 0 };
      return project(input({ startAge: 30, endAge: 31, openingBalances }))
        .months.filter((month) => month.month.startsWith('2026'))
        .reduce(
          (sum, month) => sum + ACCOUNTS.reduce((s, a) => s + month.interest.extraAccruedOn[a], 0),
          0,
        );
    };
    // Above the cap, more OA earns no more extra interest; below it, less OA earns less.
    expect(firstYearExtra(3_000_000)).toBe(firstYearExtra(2_000_000));
    expect(firstYearExtra(500_000)).toBeLessThan(firstYearExtra(2_000_000));
  });

  it('totals the interest credited in the summary', () => {
    const result = project(input({ startAge: 30, endAge: 40 }));
    const credited = result.months.reduce(
      (sum, month) => sum + ACCOUNTS.reduce((s, a) => s + month.interest.credited[a], 0),
      0,
    );
    expect(credited).toBeGreaterThan(0);
    expect(result.summary.totals.interest).toBe(credited);
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
