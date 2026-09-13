import { cn } from '@/lib/cn';
import {
  formatMoney,
  formatMoneyCompact,
  formatMoneyDelta,
  formatMoneyExact,
  formatPercent,
} from '@/lib/format';

/**
 * Inline figure renderers.
 *
 * Every rendered number in the tool goes through one of these, which is what
 * makes two guarantees enforceable in one place: figures always use tabular
 * numerals, and an abbreviated figure always carries its full value for
 * assistive tech.
 */

type MoneyFormat = 'whole' | 'exact' | 'compact';

export function Money({
  value,
  format = 'whole',
  className,
}: {
  value: number;
  format?: MoneyFormat;
  className?: string;
}) {
  const text =
    format === 'compact'
      ? formatMoneyCompact(value)
      : format === 'exact'
        ? formatMoneyExact(value)
        : formatMoney(value);

  return (
    <span
      data-numeric
      className={cn('tabular-nums', className)}
      // Compact figures are spoken in full. Exact and whole already are.
      aria-label={format === 'compact' ? formatMoney(value) : undefined}
    >
      {text}
    </span>
  );
}

/**
 * A difference between two figures.
 *
 * Neutral by default. Whether a delta is good or bad is a judgement, and the
 * framing constraint rules out the tool making it for the user: more OA
 * retained is not "better" if it means a smaller flat. A sign and a word do
 * the work; colour is opt-in for the narrow cases where direction is
 * unambiguous, such as accrued interest owed.
 */
export function MoneyDelta({
  value,
  tone = 'neutral',
  className,
}: {
  value: number;
  tone?: 'neutral' | 'directional';
  className?: string;
}) {
  const direction = value > 0 ? 'higher' : value < 0 ? 'lower' : 'no change';
  return (
    <span
      data-numeric
      className={cn(
        'tabular-nums',
        tone === 'directional' && value > 0 && 'text-good-ink',
        tone === 'directional' && value < 0 && 'text-critical-ink',
        className,
      )}
      aria-label={value === 0 ? 'No change' : `${formatMoney(Math.abs(value))} ${direction}`}
    >
      {formatMoneyDelta(value)}
    </span>
  );
}

export function Percent({
  value,
  digits = 2,
  className,
}: {
  /** A fraction, e.g. 0.6217. */
  value: number;
  digits?: number;
  className?: string;
}) {
  return (
    <span data-numeric className={cn('tabular-nums', className)}>
      {formatPercent(value, digits)}
    </span>
  );
}
