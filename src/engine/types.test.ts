import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import type { AccountAmounts, ProjectionEvent, ProjectionEventKind, ProjectionMonth } from './types';

/*
 * The engine does not exist yet, so these tests hold the contract rather than
 * any behaviour: a month must name the rules that produced it, and an event
 * must be data a caller can read. Both are compile-time properties, checked
 * here by construction so they fail loudly if the types are loosened.
 */

const nothing: AccountAmounts = { ordinary: 0, special: 0, medisave: 0, retirement: 0 };

/** A month with no wage, no contribution and no interest: the smallest valid record. */
const emptyMonth: ProjectionMonth = {
  month: '2026-01',
  ageInMonths: 30 * 12,
  ruleSetId: CURRENT_RULE_SET.id,
  openingBalances: nothing,
  closingBalances: nothing,
  ordinaryWage: 0,
  contribution: {
    ordinaryWageSubjectToCpf: 0,
    total: 0,
    employee: 0,
    employer: 0,
    allocation: nothing,
  },
  interest: {
    baseAccrued: nothing,
    extraAccruedOn: nothing,
    extraAccruedTo: nothing,
    credited: nothing,
  },
  events: [],
};

describe('ProjectionMonth', () => {
  it('carries the rule set it was computed under', () => {
    expect(emptyMonth.ruleSetId).toBe(CURRENT_RULE_SET.id);
  });

  it('will not type-check without one', () => {
    const { ruleSetId, ...withoutRuleSet } = emptyMonth;
    // @ts-expect-error every month must name its rules, so this is not a ProjectionMonth
    const invalid: ProjectionMonth = withoutRuleSet;
    // The assertions exist to use both bindings; the type error above is the test.
    expect(invalid).not.toHaveProperty('ruleSetId');
    expect(ruleSetId).toBeTypeOf('string');
  });
});

describe('ProjectionEvent', () => {
  const events: ProjectionEvent[] = [
    { kind: 'property-purchased', fromOrdinaryAccount: 0, fromCash: 0, loanPrincipal: 0 },
    {
      kind: 'age-55-transition',
      transferredFromSpecial: 0,
      transferredFromOrdinary: 0,
      fullRetirementSum: CURRENT_RULE_SET.thresholds.fullRetirementSum * 100,
      withdrawable: 0,
    },
    {
      kind: 'basic-healthcare-sum-reached',
      basicHealthcareSum: CURRENT_RULE_SET.thresholds.basicHealthcareSum * 100,
      overflow: 0,
      overflowTo: 'special',
    },
    { kind: 'housing-loan-cleared', totalInterestPaid: 0 },
  ];

  it('covers the events the spec names', () => {
    const kinds = events.map((event) => event.kind);
    const required: ProjectionEventKind[] = [
      'age-55-transition',
      'basic-healthcare-sum-reached',
      'housing-loan-cleared',
    ];
    for (const kind of required) expect(kinds).toContain(kind);
  });

  it('is exhaustive, so a new kind cannot be added without handling it', () => {
    // A caller switching on `kind` gets a compile error when a kind is added
    // and left unhandled. This is the interface's guarantee that a new event
    // cannot appear on a chart as a silent gap.
    const describeEvent = (event: ProjectionEvent): string => {
      switch (event.kind) {
        case 'property-purchased':
          return 'property purchased';
        case 'age-55-transition':
          return 'age 55 transition';
        case 'basic-healthcare-sum-reached':
          return 'Basic Healthcare Sum reached';
        case 'housing-loan-cleared':
          return 'housing loan cleared';
        default: {
          const unhandled: never = event;
          return unhandled;
        }
      }
    };

    expect(events.map(describeEvent)).toEqual([
      'property purchased',
      'age 55 transition',
      'Basic Healthcare Sum reached',
      'housing loan cleared',
    ]);
  });
});
