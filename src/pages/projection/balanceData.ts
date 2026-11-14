import type { AccountAmounts, AccountName, ProjectionResult } from '@/engine/types';
import { BALANCE_SERIES, type BalanceSeriesKey } from '@/theme/series';

/**
 * The balance chart's data: yearly rows from a projection, and the points the
 * chart draws from them. Pure, so the chart, its tables and the tests share
 * one definition of "the balance at an age".
 */

export const AGE_55 = 55;

/** The engine account each balance series draws. */
export const ACCOUNT_OF: Record<BalanceSeriesKey, AccountName> = {
  oa: 'ordinary',
  sa: 'special',
  ma: 'medisave',
  ra: 'retirement',
};

/** Balances, in dollars, at the end of the month the member reaches each age. */
export interface YearRow {
  age: number;
  balances: AccountAmounts;
  total: number;
}

/** Scenario B's key for a series in a merged comparison point: `b_oa`, `b_sa`, ... */
export const scenarioBKey = (key: BalanceSeriesKey) => `b_${key}` as const;

/**
 * A chart point: dollars per series, `null` where the account does not exist
 * at that age. With a comparison, scenario B's series sit under `b_` keys.
 */
export type ChartPoint = { age: number } & Partial<
  Record<BalanceSeriesKey | ReturnType<typeof scenarioBKey>, number | null>
>;

const toDollars = (cents: number) => cents / 100;

/** One row per whole year of age, from the start age to the end age. */
export function yearlyRows(result: ProjectionResult): YearRow[] {
  const byAgeInMonths = new Map(result.months.map((month) => [month.ageInMonths, month]));
  const rows: YearRow[] = [];
  for (let age = result.input.startAge; age <= result.input.endAge; age += 1) {
    const month = byAgeInMonths.get(age * 12);
    if (!month) continue;
    const b = month.closingBalances;
    const balances: AccountAmounts = {
      ordinary: toDollars(b.ordinary),
      special: toDollars(b.special),
      medisave: toDollars(b.medisave),
      retirement: toDollars(b.retirement),
    };
    rows.push({
      age,
      balances,
      total: balances.ordinary + balances.special + balances.medisave + balances.retirement,
    });
  }
  return rows;
}

/**
 * The Special Account line ends the year before 55 and the Retirement Account
 * line starts at 55: the two never exist together, and a zero would draw a
 * false drop to the axis.
 */
export function chartPoints(rows: readonly YearRow[]): ChartPoint[] {
  return rows.map(({ age, balances }) => ({
    age,
    oa: balances.ordinary,
    sa: age < AGE_55 ? balances.special : null,
    ma: balances.medisave,
    ra: age >= AGE_55 ? balances.retirement : null,
  }));
}

/** A's and B's points merged by age; B's series are keyed `b_oa`, `b_sa`, ... */
export function comparisonPoints(rowsA: readonly YearRow[], rowsB: readonly YearRow[]): ChartPoint[] {
  const byAge = new Map<number, ChartPoint>();
  for (const point of chartPoints(rowsA)) byAge.set(point.age, { ...point });
  for (const point of chartPoints(rowsB)) {
    const merged: ChartPoint = byAge.get(point.age) ?? { age: point.age };
    for (const key of BALANCE_SERIES) merged[scenarioBKey(key)] = point[key] ?? null;
    byAge.set(point.age, merged);
  }
  return [...byAge.values()].sort((x, y) => x.age - y.age);
}

/** Ages present in either set of rows, ascending. */
export function unionAges(...sets: readonly (readonly YearRow[])[]): number[] {
  return [...new Set(sets.flatMap((rows) => rows.map((row) => row.age)))].sort((a, b) => a - b);
}

/** The start age, every multiple of five after it, and the end age. */
export function ageTicks(startAge: number, endAge: number): number[] {
  const ticks = new Set([startAge, endAge]);
  for (let age = Math.ceil(startAge / 5) * 5; age < endAge; age += 5) ticks.add(age);
  return [...ticks].sort((a, b) => a - b);
}
