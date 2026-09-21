import { describe, expect, it } from 'vitest';
import { RULE_SET_2026 } from '@/rules/ruleset-2026';
import { SOURCES, bandForAge } from '@/rules';
import {
  ALLOCATION_FIXTURES,
  BASE_INTEREST_FIXTURES,
  CONTRIBUTION_FIXTURES,
  EXTRA_INTEREST_FIXTURES,
  HOUSING_ACCRUED_INTEREST_FIXTURES,
} from './index';
import type { AccountAmounts, AccountName, Derived } from './types';

/*
 * These tests check the fixtures, not the engine. They catch a figure
 * mistyped while transcribing it, by confirming that each published result
 * follows from the rules its own source states. The engine tests import the
 * same fixtures and hold the engine to them.
 */

/** A rate as a whole number of basis points, so the arithmetic below stays exact. */
const bp = (rate: number) => Math.round(rate * 10_000);

/** One dollar in units of cents times basis points. */
const DOLLAR = 100 * 10_000;

const derivedFixtures: readonly Derived[] = [
  ...BASE_INTEREST_FIXTURES,
  ...EXTRA_INTEREST_FIXTURES,
  ...HOUSING_ACCRUED_INTEREST_FIXTURES,
];

const allFixtures = [...CONTRIBUTION_FIXTURES, ...ALLOCATION_FIXTURES, ...derivedFixtures];

const ACCOUNTS: readonly AccountName[] = ['ordinary', 'special', 'medisave', 'retirement'];

/** Compares two per-account maps, treating an absent account as zero. */
function expectAmounts(actual: AccountAmounts, expected: AccountAmounts, label: string) {
  for (const account of ACCOUNTS) {
    expect(actual[account] ?? 0, `${label}: ${account}`).toBe(expected[account] ?? 0);
  }
}

describe('fixture registry', () => {
  it('gives every fixture a unique id', () => {
    const ids = allFixtures.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allFixtures.map((f) => [f.id, f] as const))('%s cites a registered source', (_id, fixture) => {
    if ('cite' in fixture) {
      expect(SOURCES).toHaveProperty(fixture.cite.sourceId);
      expect(fixture.cite.locator).not.toBe('');
    }
    if ('assumes' in fixture) expect(SOURCES).toHaveProperty(fixture.assumes.cite.sourceId);
  });

  it.each(derivedFixtures.map((f) => [f.id, f] as const))(
    '%s quotes the rules it was derived from',
    (_id, fixture) => {
      // A derived fixture stands on its quoted rule text. Without it there is
      // nothing to review, and the figures are just this project's opinion.
      expect(fixture.derived).toBe(true);
      expect(fixture.rules.length).toBeGreaterThan(0);
      expect(fixture.workings.length).toBeGreaterThan(0);
      for (const rule of fixture.rules) {
        expect(SOURCES).toHaveProperty(rule.cite.sourceId);
        expect(rule.quote.length).toBeGreaterThan(20);
      }
    },
  );

  it('never marks a transcribed fixture as derived', () => {
    for (const fixture of [...CONTRIBUTION_FIXTURES, ...ALLOCATION_FIXTURES]) {
      expect(fixture, fixture.id).not.toHaveProperty('derived');
    }
  });
});

/*
 * The derived fixtures below are re-computed from the same rule text, which
 * catches arithmetic slips in the hand-worked figures. It cannot catch a
 * misreading of the rule: only CPF Board can settle that.
 */

describe('derived interest fixtures', () => {
  const { interest } = RULE_SET_2026;
  const rateFor: Record<AccountName, number> = {
    ordinary: interest.ordinary,
    special: interest.special,
    medisave: interest.medisave,
    retirement: interest.retirement,
  };

  it.each(BASE_INTEREST_FIXTURES.map((f) => [f.id, f] as const))(
    '%s earns base interest monthly, with contributions earning from the next month',
    (_id, fixture) => {
      const earned: AccountAmounts = {};
      for (const account of ACCOUNTS) {
        let balance = fixture.openingBalances[account] ?? 0;
        let total = 0;
        for (let month = 1; month <= 12; month++) {
          total += (balance * rateFor[account]) / 12;
          for (const paid of fixture.contributions ?? []) {
            if (paid.month === month && paid.account === account) balance += paid.amount;
          }
        }
        if (total > 0) earned[account] = Math.round(total);
      }
      expectAmounts(earned, fixture.expected, fixture.id);
    },
  );

  it.each(EXTRA_INTEREST_FIXTURES.map((f) => [f.id, f] as const))(
    '%s fills the tiers in the published order, capping the Ordinary Account',
    (_id, fixture) => {
      const from55 = fixture.age >= 55;
      const tiers = (from55 ? interest.extraTiersFrom55 : interest.extraTiersBelow55).map((tier) => ({
        remaining: tier.amount * 100,
        rate: tier.rate,
      }));
      const cap = interest.ordinaryAccountExtraInterestCap * 100;
      const counted: AccountAmounts = {};
      const earnedOn: AccountAmounts = {};
      const creditedTo: AccountAmounts = {};

      // The published order: RA first, then OA up to its cap, then SA, then MA.
      for (const account of ['retirement', 'ordinary', 'special', 'medisave'] as const) {
        const balance = fixture.balances[account] ?? 0;
        let eligible = account === 'ordinary' ? Math.min(balance, cap) : balance;
        counted[account] = 0;
        earnedOn[account] = 0;
        for (const tier of tiers) {
          if (eligible <= 0) break;
          const taken = Math.min(eligible, tier.remaining);
          tier.remaining -= taken;
          eligible -= taken;
          counted[account] += taken;
          earnedOn[account] += taken * tier.rate;
        }
        const creditAccount = account === 'ordinary' ? (from55 ? 'retirement' : 'special') : account;
        creditedTo[creditAccount] = (creditedTo[creditAccount] ?? 0) + earnedOn[account];
      }

      expectAmounts(counted, fixture.expectedCounted, `${fixture.id} counted`);
      expectAmounts(earnedOn, fixture.expectedEarnedOn, `${fixture.id} earned on`);
      expectAmounts(creditedTo, fixture.expectedCreditedTo, `${fixture.id} credited to`);
    },
  );
});

describe('derived housing fixtures', () => {
  it.each(HOUSING_ACCRUED_INTEREST_FIXTURES.map((f) => [f.id, f] as const))(
    '%s compounds annually on the cumulative principal',
    (_id, fixture) => {
      const rate = RULE_SET_2026.housing.accruedInterestRate;
      let principal = 0;
      let balance = 0;
      for (let year = 1; year <= fixture.years; year++) {
        for (const drawn of fixture.withdrawals) {
          if (drawn.year === year) {
            principal += drawn.amount;
            balance += drawn.amount;
          }
        }
        balance *= 1 + rate;
      }
      expect(principal).toBe(fixture.expected.principal);
      expect(Math.round(balance - principal)).toBe(fixture.expected.accruedInterest);
      expect(Math.round(balance)).toBe(fixture.expected.refundable);
    },
  );
});

describe('contribution fixtures', () => {
  const cases = CONTRIBUTION_FIXTURES.map((f) => [f.id, f] as const);

  it.each(cases)('%s follows the published rounding steps', (_id, { assumes, wageSubjectToCpf, expected }) => {
    const total = Math.floor((wageSubjectToCpf * bp(assumes.total) + DOLLAR / 2) / DOLLAR) * 100;
    const employee = Math.floor((wageSubjectToCpf * bp(assumes.employee)) / DOLLAR) * 100;
    expect(expected.total).toBe(total);
    expect(expected.employee).toBe(employee);
    expect(expected.employer).toBe(total - employee);
  });

  it.each(cases)('%s caps Ordinary Wages at the ceiling it assumes', (_id, fixture) => {
    if (fixture.component !== 'ordinary') return;
    expect(fixture.wageSubjectToCpf).toBeLessThanOrEqual(fixture.assumes.ordinaryWageCeiling);
    if (fixture.wagePaid !== undefined) {
      expect(fixture.wageSubjectToCpf).toBe(
        Math.min(fixture.wagePaid, fixture.assumes.ordinaryWageCeiling),
      );
    }
  });

  it('assumes the 2026 rule set wherever it cites the 2026 table', () => {
    const current = CONTRIBUTION_FIXTURES.filter(
      (f) => f.assumes.cite.sourceId === 'contributionRateTable2026',
    );
    expect(current).toHaveLength(RULE_SET_2026.contributionRates.bands.length);
    for (const { id, assumes } of current) {
      const band = RULE_SET_2026.contributionRates.bands.find((b) => b.throughAge === assumes.throughAge);
      expect(band, id).toBeDefined();
      expect(bp(assumes.employee), id).toBe(bp(band!.employee));
      expect(bp(assumes.total), id).toBe(bp(band!.employee + band!.employer));
      expect(assumes.ordinaryWageCeiling, id).toBe(RULE_SET_2026.wageCeilings.ordinaryWageCeiling * 100);
    }
  });

  it('includes cases that round the total both down and up', () => {
    const roundingDirections = CONTRIBUTION_FIXTURES.map(({ assumes, wageSubjectToCpf, expected }) =>
      Math.sign(expected.total * 10_000 - wageSubjectToCpf * bp(assumes.total)),
    );
    expect(roundingDirections).toContain(1);
    expect(roundingDirections).toContain(-1);
  });
});

describe('allocation fixtures', () => {
  const cases = ALLOCATION_FIXTURES.map((f) => [f.id, f] as const);

  it.each(cases)('%s computes MediSave, then Special or Retirement, then the remainder', (_id, fixture) => {
    const { contribution, ratios, expected } = fixture;
    expect(expected.medisave * 10_000).toBe(contribution * bp(ratios.medisave));
    expect(expected.specialOrRetirement * 10_000).toBe(contribution * bp(ratios.specialOrRetirement));
    expect(expected.ordinary).toBe(contribution - expected.medisave - expected.specialOrRetirement);
  });

  it.each(cases)('%s uses the ratios in the 2026 rule set for its age', (_id, { age, ratios }) => {
    const band = bandForAge(RULE_SET_2026.allocation.bands, age);
    expect(band).toBeDefined();
    expect(ratios.medisave).toBe(band!.medisave);
    expect(ratios.specialOrRetirement).toBe(band!.specialOrRetirement);
  });
});
