/**
 * The data-series registry.
 *
 * Colour follows the entity, never its rank: the Ordinary Account is blue in
 * every chart, in every scenario, whether or not the other three are on screen.
 * Nothing may assign a series colour by array index at render time — read it
 * from here.
 *
 * The five hues are validated categorical slots 1, 2, 3, 7 and 8 of the
 * reference palette, checked as a set against both surfaces. Re-run the
 * validator before changing any of them; see docs/design-system.md.
 */

export type SeriesKey = 'oa' | 'sa' | 'ma' | 'ra' | 'accrued';

export interface SeriesMeta {
  key: SeriesKey;
  /** Full name, used in legends, tables and screen-reader text. */
  label: string;
  /** Three-letter form, used where space is tight. Always explained nearby. */
  short: string;
  /** Theme-aware stroke colour. Resolves per theme without a React re-render. */
  color: string;
  /** Theme-aware fill for areas and swatch backgrounds. */
  soft: string;
  /** SVG pattern id for the texture fill — the CVD, print and forced-colors relief. */
  pattern: string;
  /** One line of plain English, shown in the legend tooltip and the glossary. */
  description: string;
}

export const SERIES: Record<SeriesKey, SeriesMeta> = {
  oa: {
    key: 'oa',
    label: 'Ordinary Account',
    short: 'OA',
    color: 'var(--series-oa)',
    soft: 'var(--series-oa-soft)',
    pattern: 'texture-oa',
    description:
      'Usable for housing, insurance, education and investment. Interest floor of 2.5% a year.',
  },
  sa: {
    key: 'sa',
    label: 'Special Account',
    short: 'SA',
    color: 'var(--series-sa)',
    soft: 'var(--series-sa-soft)',
    pattern: 'texture-sa',
    description:
      'Set aside for retirement. Interest floor of 4% a year. Closed from age 55, when the balance moves to the Retirement Account.',
  },
  ma: {
    key: 'ma',
    label: 'MediSave Account',
    short: 'MA',
    color: 'var(--series-ma)',
    soft: 'var(--series-ma-soft)',
    pattern: 'texture-ma',
    description:
      'Set aside for healthcare. Interest floor of 4% a year. Capped at the Basic Healthcare Sum, above which contributions overflow to another account.',
  },
  ra: {
    key: 'ra',
    label: 'Retirement Account',
    short: 'RA',
    color: 'var(--series-ra)',
    soft: 'var(--series-ra-soft)',
    pattern: 'texture-ra',
    description:
      'Created at age 55 from the Special Account first, then the Ordinary Account. Interest floor of 4% a year.',
  },
  accrued: {
    key: 'accrued',
    label: 'Accrued interest owed',
    short: 'Accrued',
    color: 'var(--series-accrued)',
    soft: 'var(--series-accrued-soft)',
    pattern: 'texture-accrued',
    description:
      'CPF principal used for property plus the interest it would otherwise have earned, at 2.5% a year compounded. Refundable to CPF on sale.',
  },
};

/**
 * Draw order for the balance chart. The Special Account and the Retirement
 * Account do not overlap in time — SA closes at the moment RA opens — so they
 * sit next to each other here without ever appearing together.
 */
export const BALANCE_SERIES: readonly SeriesKey[] = ['oa', 'sa', 'ma', 'ra'];

/** Every series, including the accrued-interest liability. */
export const ALL_SERIES: readonly SeriesKey[] = ['oa', 'sa', 'ma', 'ra', 'accrued'];

export function series(key: SeriesKey): SeriesMeta {
  return SERIES[key];
}
