import type { Cents, ProjectionEvent, ProjectionResult } from '@/engine/types';
import { formatMoney } from '@/lib/format';

/**
 * Milestones: moments in a projection the chart should explain, read from the
 * engine's events rather than recomputed. The engine is the one place that
 * knows what moved where at 55, so the words on screen cannot drift from the
 * figures beside them.
 */

type Age55Event = Extract<ProjectionEvent, { kind: 'age-55-transition' }>;

export interface Milestone {
  /** Whole years of age, the chart's x position. */
  age: number;
  /** Plain-language explanation, with the figures from the event. */
  text: string;
}

const dollars = (cents: Cents) => formatMoney(cents / 100);

/** The sentence explaining the Retirement Account being formed, from its event. */
export function age55Text(event: Age55Event): string {
  const moved: string[] = [];
  if (event.transferredFromSpecial > 0) {
    moved.push(`${dollars(event.transferredFromSpecial)} from the Special Account`);
  }
  if (event.transferredFromOrdinary > 0) {
    moved.push(`${dollars(event.transferredFromOrdinary)} from the Ordinary Account`);
  }
  const from = moved.length > 0 ? `${moved.join(' and ')}, ` : '';
  const sum = event.fullRetirementSumSetAside
    ? `up to the Full Retirement Sum of ${dollars(event.fullRetirementSum)}`
    : `which is less than the Full Retirement Sum of ${dollars(event.fullRetirementSum)}`;
  const remainder =
    event.specialAccountRemainderToOrdinary > 0
      ? ` The ${dollars(event.specialAccountRemainderToOrdinary)} of Special Account savings it had no room for moves to the Ordinary Account.`
      : '';
  const effect =
    event.transferredFromOrdinary > 0
      ? 'This is why the Ordinary Account falls and the Retirement Account appears.'
      : 'This is why the Special Account closes and the Retirement Account appears.';
  return `At 55 the Retirement Account is formed with ${from}${sum}. ${effect}${remainder}`;
}

/** The age-55 milestone, or undefined if the projection never reaches 55. */
export function age55Milestone(result: ProjectionResult): Milestone | undefined {
  for (const month of result.months) {
    for (const event of month.events) {
      if (event.kind === 'age-55-transition') {
        return { age: Math.floor(month.ageInMonths / 12), text: age55Text(event) };
      }
    }
  }
  return undefined;
}
