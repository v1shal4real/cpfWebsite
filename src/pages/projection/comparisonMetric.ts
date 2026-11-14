import type { AccountAmounts, ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';

/**
 * The headline comparison metric (KAN-45, docs/decisions/comparison-metric.md):
 * the difference in combined CPF balances at 55, scenario B against scenario A.
 *
 * Wording rules. The sentence states a difference, never a preference: B is
 * always compared with A, so the sign never depends on which is larger;
 * "higher" and "lower" are the only direction words; the figure is in ink,
 * with no good/bad colour.
 */

const totalOf = (b: AccountAmounts) => b.ordinary + b.special + b.medisave + b.retirement;

export interface ComparisonMetric {
  /** Combined balances at 55, in dollars. */
  a: number;
  b: number;
  /** `b - a`, in dollars. */
  difference: number;
  /** The one sentence shown with the figure. */
  sentence: string;
}

/** Combined balances at 55, in dollars; `null` when the projection ends before 55. */
export function combinedAt55(result: ProjectionResult): number | null {
  const at55 = result.summary.atAge55;
  return at55 ? totalOf(at55.balances) / 100 : null;
}

/** Differences under half a dollar are shown as the same: figures are whole dollars. */
const SAME_BELOW = 0.5;

export function comparisonSentence(a: number, b: number): string {
  const difference = b - a;
  if (Math.abs(difference) < SAME_BELOW) return 'Combined balances at 55 are the same in both scenarios.';
  const direction = difference > 0 ? 'higher' : 'lower';
  return `Combined balances at 55: ${formatMoney(Math.abs(difference))} ${direction} in scenario B than in scenario A.`;
}

export function comparisonMetric(
  resultA: ProjectionResult,
  resultB: ProjectionResult,
): ComparisonMetric | null {
  const a = combinedAt55(resultA);
  const b = combinedAt55(resultB);
  if (a === null || b === null) return null;
  return { a, b, difference: b - a, sentence: comparisonSentence(a, b) };
}
