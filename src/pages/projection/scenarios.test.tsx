import fc from 'fast-check';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateProjectionInput } from '@/engine/validate';
import { ProjectionPage } from '@/pages/ProjectionPage';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import {
  changedFields,
  duplicateIntoB,
  removeB,
  singleScenario,
  updateActive,
  type Scenarios,
} from './scenarios';
import { decodeScenariosUrl, encodeScenariosUrl, encodeUrlState } from './urlState';

const START = '2026-10';
const RULES = 'sg-cpf-2026-01';

const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 125_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
};

const roundTrip = (scenarios: Scenarios) =>
  decodeScenariosUrl(encodeScenariosUrl({ scenarios, startMonth: START, rulesAsAt: RULES }), {
    startMonth: '2030-01',
  });

describe('scenario state', () => {
  it('starts B as an exact copy of A and switches to it', () => {
    const withB = duplicateIntoB(singleScenario(HDB));
    expect(withB.b).toEqual(HDB);
    expect(withB.b).not.toBe(withB.a);
    expect(withB.active).toBe('b');
    expect(changedFields(withB.a, withB.b!).size).toBe(0);
  });

  it('edits only the active scenario', () => {
    const edited = updateActive(duplicateIntoB(singleScenario(HDB)), { downpayment: 200_000 });
    expect(edited.a.downpayment).toBe(125_000);
    expect(edited.b!.downpayment).toBe(200_000);
    expect(removeB(edited)).toEqual({ a: HDB, b: null, active: 'a' });
  });

  it('marks exactly the fields B changed', () => {
    const b = { ...HDB, downpayment: 200_000, monthlySalary: 6_000 };
    expect([...changedFields(HDB, b)].sort()).toEqual(['downpayment', 'monthlySalary']);
  });

  it('marks housing fields B adds to a plan-free A, and ignores ones B does not use', () => {
    expect([...changedFields(DEFAULT_FORM, HDB)]).toEqual(
      expect.arrayContaining([
        'housingPlan',
        'propertyPrice',
        'purchaseAge',
        'downpayment',
        'loanTenureYears',
      ]),
    );
    // B drops the property: A's housing values are not part of B, so not changes.
    expect([...changedFields(HDB, { ...HDB, housingPlan: 'none' })]).toEqual(['housingPlan']);
  });
});

describe('scenarios in the URL', () => {
  it('leaves a single-scenario link exactly as before', () => {
    const state = { form: HDB, startMonth: START, rulesAsAt: RULES };
    expect(encodeScenariosUrl({ scenarios: singleScenario(HDB), startMonth: START, rulesAsAt: RULES })).toBe(
      encodeUrlState(state),
    );
    expect(roundTrip(singleScenario(HDB)).state.scenarios.b).toBeNull();
  });

  it('writes only what B changes', () => {
    const query = encodeScenariosUrl({
      scenarios: { a: HDB, b: { ...HDB, downpayment: 200_000 }, active: 'b' },
      startMonth: START,
      rulesAsAt: RULES,
    });
    const keys = [...new URLSearchParams(query).keys()].filter((key) => key === 'B' || key.startsWith('b.'));
    expect(keys).toEqual(['B', 'b.d']);
  });

  it('round-trips B, including fields B empties and a different housing plan', () => {
    const b: FormValues = {
      ...HDB,
      housingPlan: 'bank-loan',
      bankLoanRatePercent: 3.25,
      retainedOrdinaryAccount: 10_000,
      ordinaryBalance: 15_000,
    };
    const decoded = roundTrip({
      a: { ...HDB, ordinaryBalance: 40_000 },
      b: { ...b, ordinaryBalance: null },
      active: 'a',
    });
    expect(decoded.notices).toEqual([]);
    expect(decoded.state.scenarios.b).toEqual({ ...b, ordinaryBalance: null });
  });

  it('is lossless for any pair of valid scenarios', () => {
    const form = fc.record({
      currentAge: fc.integer({ min: 20, max: 50 }),
      monthlySalary: fc.integer({ min: 2_000, max: 12_000 }),
      salaryGrowthPercent: fc.integer({ min: 0, max: 5 }),
      ordinaryBalance: fc.option(fc.integer({ min: 0, max: 200_000 }), { nil: null }),
      housingPlan: fc.constantFrom('none', 'hdb-loan', 'bank-loan') as fc.Arbitrary<
        FormValues['housingPlan']
      >,
      downpaymentShare: fc.integer({ min: 25, max: 60 }),
      loanTenureYears: fc.integer({ min: 5, max: 25 }),
      bankLoanRatePercent: fc.integer({ min: 100, max: 500 }).map((h) => h / 100),
    });
    type Generated = typeof form extends fc.Arbitrary<infer T> ? T : never;
    const toForm = (g: Generated): FormValues => {
      const housing = g.housingPlan !== 'none';
      return {
        ...DEFAULT_FORM,
        currentAge: g.currentAge,
        monthlySalary: g.monthlySalary,
        salaryGrowthPercent: g.salaryGrowthPercent,
        ordinaryBalance: g.ordinaryBalance,
        housingPlan: g.housingPlan,
        propertyPrice: housing ? 500_000 : null,
        purchaseAge: housing ? g.currentAge : null,
        downpayment: housing ? g.downpaymentShare * 5_000 : null,
        ordinaryAccountSharePercent: housing ? 50 : DEFAULT_FORM.ordinaryAccountSharePercent,
        loanTenureYears: housing ? g.loanTenureYears : null,
        bankLoanRatePercent: g.housingPlan === 'bank-loan' ? g.bankLoanRatePercent : null,
      };
    };
    const valid = (f: FormValues) => validateProjectionInput({ ...toDraft(f, START), rulesAsAt: RULES }).ok;
    fc.assert(
      fc.property(form.map(toForm).filter(valid), form.map(toForm).filter(valid), (a, b) => {
        const decoded = roundTrip({ a, b, active: 'b' });
        expect(decoded.notices).toEqual([]);
        expect(decoded.state.scenarios.a).toEqual(a);
        expect(decoded.state.scenarios.b).toEqual(b);
      }),
      { numRuns: 150 },
    );
  });

  it('falls back to scenario A for a B value it cannot read, and says so', () => {
    const query =
      encodeScenariosUrl({ scenarios: singleScenario(HDB), startMonth: START, rulesAsAt: RULES }) +
      '&B=1&b.d=abc&b.h=xyz';
    const decoded = decodeScenariosUrl(query, { startMonth: START });
    expect(decoded.state.scenarios.b).toEqual(HDB);
    expect(decoded.notices).toHaveLength(2);
    expect(decoded.notices.every((n) => n.startsWith('Scenario B:'))).toBe(true);
  });
});

describe('the page with two scenarios', () => {
  const render = (scenarios: Scenarios) =>
    renderToString(<ProjectionPage startMonth={START} initialScenarios={scenarios} />)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

  it('offers to add B when there is none', () => {
    expect(render(singleScenario())).toContain('Add scenario B');
  });

  it('marks the fields B changed, and only those', () => {
    const text = render({ a: HDB, b: { ...HDB, downpayment: 200_000 }, active: 'b' });
    expect(text).toContain('1 field differs from scenario A');
    expect(text.match(/Changed from A/g)).toHaveLength(1);
  });

  it('shows no marks while editing A', () => {
    const text = render({ a: HDB, b: { ...HDB, downpayment: 200_000 }, active: 'a' });
    expect(text).not.toContain('Changed from A');
  });
});
