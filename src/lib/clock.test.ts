import { describe, expect, it } from 'vitest';
import { currentMonth } from './clock';

describe('currentMonth', () => {
  it('formats the month as YYYY-MM', () => {
    expect(currentMonth(new Date('2026-10-12T04:00:00Z'))).toBe('2026-10');
  });

  it('uses Singapore time, so the month turns at Singapore midnight', () => {
    // 31 October 2026, 17:00 UTC is 1 November, 01:00 in Singapore.
    expect(currentMonth(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11');
    expect(currentMonth(new Date('2026-10-31T15:59:00Z'))).toBe('2026-10');
  });
});
