/**
 * Month arithmetic for the engine.
 *
 * Deliberately written without `Date`. The engine must not read the clock, and
 * the cheapest way to guarantee that is to give it no way to reach one: a
 * `YYYY-MM` stamp is a year and a month, and stepping it is integer
 * arithmetic. A test asserts that nothing under `src/engine` mentions `Date`.
 *
 * It also sidesteps the `Date` traps a forty-year projection would hit: local
 * time zones, and month-end days that do not exist in the next month.
 */

import type { MonthStamp } from './types';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface YearMonth {
  year: number;
  /** 1 for January through 12 for December. */
  month: number;
}

/**
 * Splits a `YYYY-MM` stamp.
 *
 * Throws on a malformed stamp. That is a programming error rather than bad
 * user input, which the engine's validation rejects before reaching here and
 * reports as typed errors.
 */
export function parseMonth(stamp: MonthStamp): YearMonth {
  const match = MONTH_PATTERN.exec(stamp);
  if (!match) throw new RangeError(`Not a YYYY-MM month stamp: "${stamp}"`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function formatMonth({ year, month }: YearMonth): MonthStamp {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Steps a stamp forward, or backward for a negative count. */
export function addMonths(stamp: MonthStamp, count: number): MonthStamp {
  const { year, month } = parseMonth(stamp);
  // Work in months since year zero so the year rolls over on its own.
  const total = year * 12 + (month - 1) + count;
  return formatMonth({ year: Math.floor(total / 12), month: (total % 12) + 1 });
}

/** Whole months from `from` to `to`, negative if `to` is earlier. */
export function monthsBetween(from: MonthStamp, to: MonthStamp): number {
  const a = parseMonth(from);
  const b = parseMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * The ISO date for a month, for `resolveRuleSet`.
 *
 * The first of the month: rule sets take effect on a date, and a change
 * effective mid-month applies to the following month's step rather than
 * retroactively to a month already computed.
 */
export function monthToIsoDate(stamp: MonthStamp): string {
  return `${stamp}-01`;
}
