import { RULE_SET_2026 } from './ruleset-2026';
import type { RuleSet } from './types';

export type { RuleSet } from './types';
export * from './types';
export { SOURCES, source, type Source, type SourceId } from './sources';

/**
 * Every rule set known to the tool, oldest first.
 *
 * Adding a set is how a rule change is recorded. Editing a set in place is not:
 * a shared link pinned to `sg-cpf-2026-01` must keep rendering the figures it
 * was built from, and the changelog is the diff between adjacent entries.
 */
export const RULE_SETS: readonly RuleSet[] = [RULE_SET_2026];

/** The newest rule set. What an unpinned session uses. */
export const CURRENT_RULE_SET: RuleSet = RULE_SETS[RULE_SETS.length - 1]!;

/** Shorthand for the rules-as-at stamp. */
export const RULES_AS_AT = CURRENT_RULE_SET.label;

/**
 * Resolves the rule set in force on a given ISO date.
 *
 * This is the no-lookahead boundary. The engine calls it once per step with
 * the date of that step, so a projection reaching 2031 applies the 2031 rules
 * rather than freezing today's. It deliberately takes a date argument instead
 * of reading the clock, which is what makes a projection reproducible: the
 * same inputs give the same outputs regardless of when they are run.
 */
export function resolveRuleSet(isoDate: string): RuleSet {
  let resolved: RuleSet | undefined;
  for (const set of RULE_SETS) {
    if (set.effectiveFrom > isoDate) break;
    if (set.effectiveTo === null || set.effectiveTo >= isoDate) resolved = set;
  }
  // Before the earliest set we have, fall back to the earliest rather than
  // throwing: a user entering a historical purchase date should still see a
  // projection, clearly stamped with the rules it used.
  return resolved ?? RULE_SETS[0]!;
}

/** Looks a rule set up by its pinned id, for shared links. */
export function ruleSetById(id: string): RuleSet | undefined {
  return RULE_SETS.find((set) => set.id === id);
}

/**
 * Picks the band covering an age from a list ordered by ascending
 * `throughAge`, where `null` is the open-ended final band.
 *
 * The bound is inclusive, matching CPF Board's own wording: a band written
 * "above 35 to 45" covers a member who is exactly 45.
 */
export function bandForAge<T extends { throughAge: number | null }>(
  bands: readonly T[],
  age: number,
): T | undefined {
  return bands.find((band) => band.throughAge === null || age <= band.throughAge);
}
