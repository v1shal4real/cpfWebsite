import { describe, expect, it } from 'vitest';
import {
  clamp,
  formatAgeMonths,
  formatEffectiveDate,
  formatMoney,
  formatMoneyCompact,
  formatMoneyDelta,
  formatPercent,
} from './format';

describe('format', () => {
  it('formats whole dollars with grouping', () => {
    expect(formatMoney(412_380)).toBe('$412,380');
  });

  it('abbreviates compact figures and keeps precision where it matters', () => {
    expect(formatMoneyCompact(820)).toBe('$820');
    expect(formatMoneyCompact(1_500)).toBe('$1.5k');
    expect(formatMoneyCompact(220_400)).toBe('$220k');
    expect(formatMoneyCompact(1_234_567)).toBe('$1.23M');
    expect(formatMoneyCompact(-45_000)).toBe('-$45k');
  });

  it('signs deltas explicitly', () => {
    expect(formatMoneyDelta(12_400)).toBe('+$12,400');
    expect(formatMoneyDelta(-3_100)).toBe('-$3,100');
    expect(formatMoneyDelta(0)).toBe('$0');
  });

  it('renders allocation ratios at published precision without trailing zeros', () => {
    expect(formatPercent(0.6217)).toBe('62.17%');
    expect(formatPercent(0.14)).toBe('14%');
    expect(formatPercent(0.025, 1)).toBe('2.5%');
  });

  it('formats monthly ages', () => {
    expect(formatAgeMonths(420)).toBe('35y');
    expect(formatAgeMonths(426)).toBe('35y 6m');
  });

  it('formats effective dates for the rules stamp', () => {
    expect(formatEffectiveDate('2026-01-01')).toBe('1 January 2026');
  });

  it('clamps', () => {
    expect(clamp(5, 16, 70)).toBe(16);
    expect(clamp(99, 16, 70)).toBe(70);
    expect(clamp(30, 16, 70)).toBe(30);
  });
});
