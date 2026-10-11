/**
 * The performance budget, asserted with the rest of the suite.
 *
 * Spec §3.4: a full recomputation, age 22 to 65, monthly, two scenarios, must
 * finish under 50ms so the timeline scrub feels continuous. This runs exactly
 * what the interface runs on a change, `projectDraft` on both scenarios of a
 * comparison, and fails the build if the median run goes over budget.
 *
 * Timing in a test is noisy, so the measurement is made robust rather than
 * the budget loosened: a few warm-up runs first, so the JIT has compiled the
 * engine as it would have after the first keystroke, then the median of many
 * runs, which a single slow run on a busy CI machine cannot move.
 *
 * For a breakdown of where the time goes, run `npm run bench`.
 */

import { describe, expect, it } from 'vitest';
import { RECOMPUTE_BUDGET_MS, SCENARIO_A, SCENARIO_B } from './__fixtures__/scenarios';
import { projectDraft } from './project';

const WARM_UP_RUNS = 5;
const MEASURED_RUNS = 25;

function recompute() {
  const a = projectDraft(SCENARIO_A);
  const b = projectDraft(SCENARIO_B);
  return [a, b] as const;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

describe('performance budget', () => {
  it('projects the representative scenarios: both valid, 22 to 65', () => {
    // A budget measured on inputs that fail validation would measure nothing.
    const [a, b] = recompute();
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.result.months).toHaveLength((65 - 22) * 12 + 1);
      expect(b.result.months).toHaveLength((65 - 22) * 12 + 1);
    }
  });

  it(`recomputes both scenarios in under ${RECOMPUTE_BUDGET_MS}ms`, () => {
    for (let run = 0; run < WARM_UP_RUNS; run++) recompute();

    const timings: number[] = [];
    for (let run = 0; run < MEASURED_RUNS; run++) {
      const started = performance.now();
      recompute();
      timings.push(performance.now() - started);
    }

    const typical = median(timings);
    expect(
      typical,
      `median of ${MEASURED_RUNS} runs was ${typical.toFixed(1)}ms; slowest ${Math.max(...timings).toFixed(1)}ms`,
    ).toBeLessThan(RECOMPUTE_BUDGET_MS);
  });
});
