/**
 * Formatting helpers.
 *
 * Two rules hold throughout this file:
 *
 *   1. Every abbreviated figure has a full-precision counterpart. Anything the
 *      eye reads as "$1.2M" must be available to a screen reader as
 *      "$1,234,567". Components pair them via `aria-label`.
 *   2. Formatters never round the underlying value. They are presentation
 *      only; the projection engine works in cents and rounds where CPF's own
 *      rules say to round.
 */

const SG = 'en-SG';

const currency0 = new Intl.NumberFormat(SG, {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
});

const currency2 = new Intl.NumberFormat(SG, {
  style: 'currency',
  currency: 'SGD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain0 = new Intl.NumberFormat(SG, { maximumFractionDigits: 0 });

/** `$1,234` — the default for balances and headline figures. */
export function formatMoney(value: number): string {
  return currency0.format(value);
}

/** `$1,234.50` — for figures where cents are material, such as a monthly instalment. */
export function formatMoneyExact(value: number): string {
  return currency2.format(value);
}

/**
 * `$1.2M`, `$450k`, `$820` — axis ticks and tight tiles only.
 * Always pair with `formatMoney` in an `aria-label`.
 */
export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${trimZeros(abs / 1_000_000, 2)}M`;
  if (abs >= 10_000) return `${sign}$${plain0.format(Math.round(abs / 1000))}k`;
  if (abs >= 1000) return `${sign}$${trimZeros(abs / 1000, 1)}k`;
  return `${sign}$${plain0.format(Math.round(abs))}`;
}

/** `+$12,400` / `-$3,100` — for differences between two scenarios. */
export function formatMoneyDelta(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(value))}`;
}

/**
 * `62.17%`. `digits` defaults to 2 because CPF allocation ratios are published
 * to four decimal places as a fraction, i.e. two as a percentage.
 */
export function formatPercent(fraction: number, digits = 2): string {
  return `${trimZeros(fraction * 100, digits)}%`;
}

/** `3.5%` from an already-percentage number, e.g. a salary growth input. */
export function formatPercentPoints(points: number, digits = 1): string {
  return `${trimZeros(points, digits)}%`;
}

/** `Age 35`. */
export function formatAge(age: number): string {
  return `Age ${Math.floor(age)}`;
}

/** `35y 6m` — used on the scrub readout where the step is monthly. */
export function formatAgeMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = Math.round(totalMonths % 12);
  return months === 0 ? `${years}y` : `${years}y ${months}m`;
}

/** `1 January 2026` — the form used for every rules-as-at stamp. */
export function formatEffectiveDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Drops trailing zeros so `2.50` reads `2.5` and `3.00` reads `3`. */
function trimZeros(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** Clamps a number into a range. Shared by the sliders and the scrubber. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
