import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { validateProjectionInput } from '@/engine/validate';
import { CURRENT_RULE_SET } from '@/rules';
import { DEFAULT_FORM, toDraft, type FormValues } from './form';
import { decodeUrlState, encodeUrlState, type UrlState } from './urlState';

const START = '2026-10';
const FALLBACK = { startMonth: '2027-03' };
const RULES = CURRENT_RULE_SET.id;

const state = (form: FormValues, overrides: Partial<UrlState> = {}): UrlState => ({
  form,
  startMonth: START,
  rulesAsAt: RULES,
  ...overrides,
});

const HDB: FormValues = {
  ...DEFAULT_FORM,
  housingPlan: 'hdb-loan',
  propertyPrice: 500_000,
  purchaseAge: 32,
  downpayment: 100_000,
  ordinaryAccountSharePercent: 75,
  loanTenureYears: 25,
};

const BANK: FormValues = {
  ...HDB,
  housingPlan: 'bank-loan',
  ordinaryBalance: 12_345.67,
  specialBalance: 0,
  medisaveBalance: 8_000,
  salaryGrowthPercent: 2.5,
  loanTenureYears: 30,
  bankLoanRatePercent: 3.15,
};

const roundTrip = (given: UrlState) => decodeUrlState(encodeUrlState(given), FALLBACK);

describe('round trip: state -> URL -> state', () => {
  it.each([
    ['the defaults', DEFAULT_FORM],
    ['an HDB purchase', HDB],
    ['a bank purchase with balances and cents', BANK],
  ])('is lossless for %s', (_name, form) => {
    const decoded = roundTrip(state(form));
    expect(decoded.state).toEqual(state(form));
    expect(decoded.notices).toEqual([]);
    expect(decoded.fromLink).toBe(true);
  });

  it('is lossless for every valid form, generated', () => {
    const money = (max: number) => fc.option(fc.integer({ min: 0, max: max * 100 }).map((cents) => cents / 100), { nil: null });
    const formArbitrary = fc.record<FormValues>({
      currentAge: fc.integer({ min: 16, max: 70 }),
      monthlySalary: fc.integer({ min: 75_100, max: 3_000_000 }).map((cents) => cents / 100),
      salaryGrowthPercent: fc.integer({ min: 0, max: 2_000 }).map((hundredths) => hundredths / 100),
      ordinaryBalance: money(500_000),
      specialBalance: money(500_000),
      medisaveBalance: money(80_000),
      housingPlan: fc.constantFrom('none', 'hdb-loan', 'bank-loan'),
      propertyPrice: fc.integer({ min: 100_000, max: 2_000_000 }),
      purchaseAge: fc.integer({ min: 16, max: 65 }),
      downpayment: fc.integer({ min: 0, max: 100_000 }),
      ordinaryAccountSharePercent: fc.integer({ min: 0, max: 20 }).map((step) => step * 5),
      loanTenureYears: fc.integer({ min: 1, max: 25 }),
      bankLoanRatePercent: fc.integer({ min: 0, max: 800 }).map((hundredths) => hundredths / 100),
    });
    fc.assert(
      fc.property(
        formArbitrary.filter((form) => validateProjectionInput(toDraft(form, START)).ok),
        (form) => {
          // A link only carries what applies: housing fields without a plan,
          // and a bank rate without a bank loan, are not part of the state.
          const applicable: FormValues =
            form.housingPlan === 'none'
              ? { ...form, propertyPrice: null, purchaseAge: null, downpayment: null, ordinaryAccountSharePercent: DEFAULT_FORM.ordinaryAccountSharePercent, loanTenureYears: null, bankLoanRatePercent: null }
              : form.housingPlan === 'hdb-loan'
                ? { ...form, bankLoanRatePercent: null }
                : form;
          const decoded = roundTrip(state(applicable));
          expect(decoded.state).toEqual(state(applicable));
          expect(decoded.notices).toEqual([]);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('projects exactly the same figures from the decoded state', () => {
    const decoded = roundTrip(state(BANK));
    const before = projectDraft({ ...toDraft(BANK, START), rulesAsAt: RULES });
    const after = projectDraft({ ...toDraft(decoded.state.form, decoded.state.startMonth), rulesAsAt: decoded.state.rulesAsAt });
    expect(after).toEqual(before);
  });
});

describe('the schema', () => {
  it('is versioned and carries the rule set id and start month', () => {
    const params = new URLSearchParams(encodeUrlState(state(DEFAULT_FORM)));
    expect(params.get('v')).toBe('1');
    expect(params.get('r')).toBe(RULES);
    expect(params.get('m')).toBe(START);
  });

  it('is compact: no housing keys without a plan, no bank rate without a bank loan, no empty fields', () => {
    const none = encodeUrlState(state(DEFAULT_FORM));
    expect(none).toBe(`?v=1&r=${RULES}&m=${START}&h=n&a=30&s=5000&g=0`);
    const hdb = new URLSearchParams(encodeUrlState(state({ ...HDB, bankLoanRatePercent: 3 })));
    expect(hdb.has('br')).toBe(false);
    expect(hdb.has('ob')).toBe(false);
  });

  it('keeps the link’s own start month, so its figures do not move with the calendar', () => {
    const decoded = decodeUrlState(encodeUrlState(state(DEFAULT_FORM, { startMonth: '2026-01' })), FALLBACK);
    expect(decoded.state.startMonth).toBe('2026-01');
  });
});

describe('a bare URL', () => {
  it('opens on the defaults, this month, current rules, with nothing to report', () => {
    for (const search of ['', '?', '?utm_source=forum']) {
      expect(decodeUrlState(search, FALLBACK)).toEqual({
        state: { form: DEFAULT_FORM, startMonth: FALLBACK.startMonth, rulesAsAt: RULES },
        notices: [],
        fromLink: false,
      });
    }
  });
});

describe('malformed and old links degrade gracefully', () => {
  const link = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(encodeUrlState(state(HDB)));
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return decodeUrlState(`?${params.toString()}`, FALLBACK);
  };

  it('falls back to the defaults for a schema version it cannot read, and says so', () => {
    const decoded = link({ v: '2' });
    expect(decoded.state.form).toEqual(DEFAULT_FORM);
    expect(decoded.notices).toEqual([expect.stringMatching(/version of the tool this one cannot read/)]);
  });

  it('treats state without a version as unreadable rather than guessing', () => {
    expect(link({ v: null }).state.form).toEqual(DEFAULT_FORM);
  });

  it('uses the current rules for an unknown rule set, and says which', () => {
    const decoded = link({ r: 'sg-cpf-1999-01' });
    expect(decoded.state.rulesAsAt).toBe(RULES);
    expect(decoded.state.form).toEqual(HDB);
    expect(decoded.notices).toEqual([expect.stringContaining('sg-cpf-1999-01')]);
  });

  it('starts this month when the start month cannot be read', () => {
    const decoded = link({ m: '2026-13' });
    expect(decoded.state.startMonth).toBe(FALLBACK.startMonth);
    expect(decoded.notices).toHaveLength(1);
  });

  it('uses the default for a value that is not a number, keeping the rest', () => {
    const decoded = link({ s: 'lots' });
    expect(decoded.state.form).toEqual({ ...HDB, monthlySalary: DEFAULT_FORM.monthlySalary });
    expect(decoded.notices).toEqual([expect.stringContaining('monthly salary')]);
  });

  it('uses the default for a value the engine would reject', () => {
    const decoded = link({ a: '200' });
    expect(decoded.state.form.currentAge).toBe(DEFAULT_FORM.currentAge);
    expect(decoded.notices).toEqual([expect.stringContaining('current age')]);
  });

  it('drops the property as a whole when any of its details cannot be used', () => {
    const decoded = link({ t: '99' });
    expect(decoded.state.form.housingPlan).toBe('none');
    expect(decoded.state.form.propertyPrice).toBeNull();
    expect(decoded.notices).toEqual([expect.stringMatching(/property details/)]);
  });

  it('shows no property for a housing plan it does not recognise', () => {
    const decoded = link({ h: 'condo' });
    expect(decoded.state.form.housingPlan).toBe('none');
    expect(decoded.notices[0]).toMatch(/housing plan/);
  });

  it('always opens on something that can be projected', () => {
    const awful = '?v=1&r=x&m=nope&h=bank&a=-3&s=0&g=900&ob=-1&p=1&pa=10&d=99999999&os=500&t=0&br=abc';
    const decoded = decodeUrlState(awful, FALLBACK);
    expect(projectDraft({ ...toDraft(decoded.state.form, decoded.state.startMonth), rulesAsAt: decoded.state.rulesAsAt }).ok).toBe(true);
    expect(decoded.notices.length).toBeGreaterThan(0);
  });

  it('never throws, whatever the query string', () => {
    fc.assert(
      fc.property(fc.string(), (search) => {
        expect(() => decodeUrlState(search, FALLBACK)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });
});

describe('no storage, cookies or server calls for projection state', () => {
  it('appears nowhere in the projection code', () => {
    // The theme preference is stored locally, deliberately, and is not
    // projection state; everything that touches a projection is checked.
    const roots = ['src/engine', 'src/rules', 'src/pages', 'src/App.tsx', 'src/routes.ts', 'src/lib'];
    const offenders: string[] = [];
    const visit = (path: string) => {
      if (statSync(path).isDirectory()) {
        for (const entry of readdirSync(path)) visit(join(path, entry));
        return;
      }
      if (!/\.tsx?$/.test(path) || /\.test\.tsx?$/.test(path)) return;
      const source = readFileSync(path, 'utf8');
      if (/localStorage|sessionStorage|indexedDB|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon/.test(source)) {
        offenders.push(path);
      }
    };
    for (const root of roots) visit(join(process.cwd(), root));
    expect(offenders).toEqual([]);
  });
});
