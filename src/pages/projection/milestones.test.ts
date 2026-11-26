import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import type { ProjectionResult } from '@/engine/types';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { age55Milestone } from './milestones';

function run(form: Partial<FormValues> = {}): ProjectionResult {
  const outcome = projectDraft(toDraft({ ...DEFAULT_FORM, ...form }, '2026-10'));
  if (!outcome.ok) throw new Error('projection did not validate');
  return outcome.result;
}

describe('age55Milestone', () => {
  it('reads the transition from the engine event, at the age it happens', () => {
    const milestone = age55Milestone(run());
    expect(milestone?.age).toBe(55);
    expect(milestone?.text).toContain('At 55 the Retirement Account is formed');
  });

  it('names the Ordinary Account when it funds the Retirement Account, which is the visible drop', () => {
    const text = age55Milestone(run())?.text;
    expect(text).toContain('from the Ordinary Account');
    expect(text).toContain('the Ordinary Account falls');
  });

  it('quotes the figure the engine recorded, not a recomputation', () => {
    const result = run();
    const event = result.months.flatMap((m) => m.events).find((e) => e.kind === 'age-55-transition');
    if (event?.kind !== 'age-55-transition') throw new Error('no event');
    const dollars = Math.round(event.transferredFromOrdinary / 100).toLocaleString('en-SG');
    expect(age55Milestone(result)?.text).toContain(`$${dollars}`);
  });

  it('is absent when the projection starts after 55', () => {
    expect(age55Milestone(run({ currentAge: 60 }))).toBeUndefined();
  });
});
