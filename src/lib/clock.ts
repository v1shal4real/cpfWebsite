/**
 * The one place the interface reads the clock for a projection.
 *
 * The engine never reads the date: its start month is an input. The interface
 * supplies it from here, in Singapore time, so a projection opened late on the
 * last day of a month in another time zone still starts in the month a
 * Singapore member is in.
 */

import type { MonthStamp } from '@/engine/types';

export function currentMonth(now: Date = new Date()): MonthStamp {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}
