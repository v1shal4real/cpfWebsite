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
    additionalWage: 0,
    additionalWageSubjectToCpf: 0,
    onAdditionalWage: { total: 0, employee: 0, employer: 0 },
  },
  interest: {
    baseAccrued: nothing,
    extraAccruedOn: nothing,
    extraAccruedTo: nothing,
    credited: nothing,
  },
  medisaveOverflow: {
    basicHealthcareSum: CURRENT_RULE_SET.thresholds.basicHealthcareSum * 100,
    amount: 0,
    to: nothing,
  },
  retirementTransfers: nothing,
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
    {
      kind: 'property-purchased',
      fromOrdinaryAccount: 0,
      fromCash: 0,
      loanPrincipal: 0,
      grant: 0,
      afterSale: false,
    },
    {
      kind: 'age-55-transition',
      transferredFromSpecial: 0,
      transferredFromOrdinary: 0,
      specialAccountRemainderToOrdinary: 0,
      retirementAccount: 0,
      fullRetirementSum: CURRENT_RULE_SET.thresholds.fullRetirementSum * 100,
      fullRetirementSumSetAside: false,
      withdrawable: 0,
      from55RulesApplyFrom: '2026-02',
    },
    {
      kind: 'basic-healthcare-sum-reached',
      basicHealthcareSum: CURRENT_RULE_SET.thresholds.basicHealthcareSum * 100,
      overflow: 0,
      overflowTo: nothing,
    },
    { kind: 'housing-loan-cleared', principal: 0, instalmentsPaid: 0, totalInterestPaid: 0 },
    {
      kind: 'property-sold',
      salePrice: 0,
      outstandingLoan: 0,
      refundDue: 0,
      refunded: 0,
      refundNotCovered: 0,
      refundedToRetirement: 0,
      refundedToOrdinary: 0,
      cashProceeds: 0,
    },
    {
      kind: 'voluntary-housing-refund',
      asked: 0,
      refunded: 0,
      toPrincipal: 0,
      toInterest: 0,
      refundedToRetirement: 0,
      refundedToOrdinary: 0,
      refundableAfter: 0,
    },
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
        case 'property-sold':
          return 'property sold';
        case 'voluntary-housing-refund':
          return 'voluntary housing refund';
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
      'property sold',
      'voluntary housing refund',
    ]);
  });
});
