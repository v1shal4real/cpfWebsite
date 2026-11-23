/**
 * How figures are shown: in each year's own dollars (nominal), or in today's
 * dollars at a stated inflation rate (real). A display setting, not an input:
 * it applies to every scenario alike, and changes no projection.
 *
 * In the link: `real=1` for today's dollars, `inf` the inflation rate in
 * percent. Left out when nominal, so existing links are unchanged.
 */

export interface DisplaySettings {
  realTerms: boolean;
  /** Percentage points a year. */
  inflationPercent: number;
}

/**
 * The default inflation rate: MAS Core Inflation's historical mean, "about
 * 1.7% y-o-y" (MAS, Macroeconomic Review, October 2026, source
 * `masMacroeconomicReviewOct2026`). Core inflation leaves out accommodation
 * and private transport. A stated, editable assumption, not a forecast.
 */
export const DEFAULT_INFLATION_PERCENT = 1.7;

export const INFLATION_LIMITS = { min: 0, max: 10 } as const;

export const DEFAULT_DISPLAY: DisplaySettings = {
  realTerms: false,
  inflationPercent: DEFAULT_INFLATION_PERCENT,
};

export function encodeDisplay(display: DisplaySettings, params: URLSearchParams): void {
  if (!display.realTerms) return;
  params.set('real', '1');
  params.set('inf', String(Math.round(display.inflationPercent * 100) / 100));
}

/** Never throws: a value it cannot use falls back to the default. */
export function decodeDisplay(search: string): DisplaySettings {
  const params = new URLSearchParams(search);
  if (params.get('real') !== '1') return DEFAULT_DISPLAY;
  const text = params.get('inf') ?? '';
  const raw = Number(text);
  // Number('') is 0: an empty or non-numeric value is unusable, not zero.
  const usable = /^\d+(\.\d+)?$/.test(text) && raw >= INFLATION_LIMITS.min && raw <= INFLATION_LIMITS.max;
  return { realTerms: true, inflationPercent: usable ? raw : DEFAULT_INFLATION_PERCENT };
}

/** One line saying which dollars the figures are in. */
export function describeDisplay(display: DisplaySettings): string {
  return display.realTerms
    ? `Figures in today's dollars, at ${display.inflationPercent}% inflation a year.`
    : "Figures in each year's own dollars, not adjusted for inflation.";
}
