import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { project, projectDraft } from './project';
import { INPUT_LIMITS, validateProjectionInput, type ProjectionDraft, type ValidationResult } from './validate';

const NO_HOUSING: ProjectionDraft = {
  startMonth: '2026-01',
  currentAge: 30,
  monthlySalary: 500_000,
  salaryGrowthRate: 0.03,
  housingPlan: 'none',
};

const HDB_PURCHASE: ProjectionDraft = {
  ...NO_HOUSING,
  housingPlan: 'hdb-loan',
  propertyPrice: 50_000_000,
  purchaseAge: 32,
  downpayment: 10_000_000,
  downpaymentShareFromOrdinaryAccount: 0.75,
  loanTenureYears: 25,
};

const BANK_PURCHASE: ProjectionDraft = {
  ...HDB_PURCHASE,
  housingPlan: 'bank-loan',
  loanTenureYears: 30,
  bankLoanRate: 0.03,
};

const errorsOf = (result: ValidationResult) => (result.ok ? [] : result.errors);
const codeFor = (result: ValidationResult, field: string) =>
  errorsOf(result).find((error) => error.field === field)?.code;
const valid = (result: ValidationResult) => {
  if (!result.ok) throw new Error(`expected valid, got ${JSON.stringify(result.errors)}`);
  return result;
};

describe('a complete draft', () => {
  it('builds the engine input, with stated defaults for optional fields', () => {
    const { input, adjustments } = valid(validateProjectionInput(NO_HOUSING));
    expect(input).toEqual({
      startMonth: '2026-01',
      startAge: 30,
      endAge: 65,
      openingBalances: { ordinary: 0, special: 0, medisave: 0, retirement: 0 },
      monthlyOrdinaryWage: 500_000,
      salaryGrowth: { rate: 0.03, appliedInMonth: 1 },
    });
    expect(adjustments).toEqual([]);
  });

  it('carries opening balances and the raise month through', () => {
    const { input } = valid(
      validateProjectionInput({
        ...NO_HOUSING,
        salaryRaiseMonth: 4,
        balances: { ordinary: 100, special: 200, medisave: 300 },
      }),
    );
    expect(input.openingBalances).toEqual({ ordinary: 100, special: 200, medisave: 300, retirement: 0 });
    expect(input.salaryGrowth.appliedInMonth).toBe(4);
  });

  it('builds the housing plan: loan as price less downpayment, the downpayment split by the OA share', () => {
    const { input } = valid(validateProjectionInput(HDB_PURCHASE));
    expect(input.housing).toEqual({
      purchaseAge: 32,
      price: 50_000_000,
      downpaymentFromOrdinaryAccount: 7_500_000,
      downpaymentFromCash: 2_500_000,
      loan: { kind: 'hdb-concessionary', principal: 40_000_000, tenureYears: 25 },
      instalmentsPaidFrom: 'ordinary-account',
    });
  });

  it('carries a bank loan’s own rate', () => {
    const { input } = valid(validateProjectionInput(BANK_PURCHASE));
    expect(input.housing?.loan).toEqual({ kind: 'bank', principal: 40_000_000, tenureYears: 30, interestRate: 0.03 });
  });
});

describe('age', () => {
  it('accepts 16 to 70', () => {
    for (const currentAge of [16, 45, 70]) expect(validateProjectionInput({ ...NO_HOUSING, currentAge }).ok).toBe(true);
  });

  it('rejects ages outside 16 to 70, naming the bound', () => {
    expect(errorsOf(validateProjectionInput({ ...NO_HOUSING, currentAge: 15 }))).toEqual([
      { field: 'currentAge', code: 'below-minimum', message: 'Current age must be at least 16.', limit: 16 },
    ]);
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, currentAge: 71 }), 'currentAge')).toBe('above-maximum');
  });

  it('rejects a missing, fractional or non-numeric age', () => {
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, currentAge: undefined }), 'currentAge')).toBe('required');
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, currentAge: 30.5 }), 'currentAge')).toBe('not-a-whole-number');
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, currentAge: Number.NaN }), 'currentAge')).toBe('not-a-number');
  });

  it('projects to 65, or from the current age when older', () => {
    expect(valid(validateProjectionInput(NO_HOUSING)).input.endAge).toBe(INPUT_LIMITS.projectionEndAge);
    expect(valid(validateProjectionInput({ ...NO_HOUSING, currentAge: 68 })).input.endAge).toBe(68);
  });
});

describe('salary', () => {
  it('rejects a salary that attracts graduated CPF rates, which the engine does not model', () => {
    const threshold = CURRENT_RULE_SET.contributionRates.fullRatesFromMonthlyWage * 100;
    const result = validateProjectionInput({ ...NO_HOUSING, monthlySalary: threshold });
    expect(errorsOf(result)).toEqual([
      expect.objectContaining({ field: 'monthlySalary', code: 'graduated-rates-not-modelled', limit: threshold }),
    ]);
    expect(validateProjectionInput({ ...NO_HOUSING, monthlySalary: threshold + 1 }).ok).toBe(true);
  });

  it('rejects salary growth that takes the wage down to the graduated-rate threshold during the projection', () => {
    // Found by the property tests: $760 a month falling 1% a year passes the
    // threshold within two years, where the engine would refuse the wage.
    const result = validateProjectionInput({ ...NO_HOUSING, monthlySalary: 76_000, salaryGrowthRate: -0.01 });
    expect(errorsOf(result)).toEqual([
      expect.objectContaining({ field: 'salaryGrowthRate', code: 'graduated-rates-not-modelled' }),
    ]);
    // The same cut from a salary that stays above the threshold to 65 is fine.
    expect(validateProjectionInput({ ...NO_HOUSING, monthlySalary: 500_000, salaryGrowthRate: -0.01 }).ok).toBe(true);
  });

  it('rejects a negative or missing salary', () => {
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, monthlySalary: -1 }), 'monthlySalary')).toBe('below-minimum');
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, monthlySalary: undefined }), 'monthlySalary')).toBe('required');
  });

  it('bounds salary growth and the raise month', () => {
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, salaryGrowthRate: 0.25 }), 'salaryGrowthRate')).toBe('above-maximum');
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, salaryGrowthRate: -0.2 }), 'salaryGrowthRate')).toBe('below-minimum');
    expect(validateProjectionInput({ ...NO_HOUSING, salaryGrowthRate: 0 }).ok).toBe(true);
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, salaryRaiseMonth: 13 }), 'salaryRaiseMonth')).toBe('above-maximum');
  });
});

describe('balances', () => {
  it('rejects a negative balance and rounds to the cent', () => {
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, balances: { special: -5 } }), 'balances.special')).toBe('below-minimum');
    const { input } = valid(validateProjectionInput({ ...NO_HOUSING, balances: { ordinary: 100.6 } }));
    expect(input.openingBalances.ordinary).toBe(101);
  });
});

describe('housing fields', () => {
  it('ignores every housing field when no plan is selected', () => {
    // Leftovers in hidden fields, even invalid ones, cannot block a projection.
    const result = validateProjectionInput({ ...HDB_PURCHASE, housingPlan: 'none', purchaseAge: 10, loanTenureYears: 99 });
    expect(valid(result).input.housing).toBeUndefined();
  });

  it('requires them when a plan is selected', () => {
    const result = validateProjectionInput({ ...NO_HOUSING, housingPlan: 'hdb-loan' });
    expect(errorsOf(result).map((error) => [error.field, error.code])).toEqual([
      ['propertyPrice', 'required'],
      ['purchaseAge', 'required'],
      ['downpayment', 'required'],
      ['downpaymentShareFromOrdinaryAccount', 'required'],
      ['loanTenureYears', 'required'],
    ]);
  });

  it('requires a rate for a bank loan only', () => {
    expect(codeFor(validateProjectionInput({ ...BANK_PURCHASE, bankLoanRate: undefined }), 'bankLoanRate')).toBe('required');
    expect(validateProjectionInput({ ...HDB_PURCHASE, bankLoanRate: undefined }).ok).toBe(true);
  });

  it('rejects a purchase age before the current age or after the projection ends', () => {
    expect(codeFor(validateProjectionInput({ ...HDB_PURCHASE, purchaseAge: 29 }), 'purchaseAge')).toBe('before-current-age');
    expect(codeFor(validateProjectionInput({ ...HDB_PURCHASE, purchaseAge: 66 }), 'purchaseAge')).toBe('after-projection-end');
    expect(validateProjectionInput({ ...HDB_PURCHASE, purchaseAge: 30 }).ok).toBe(true);
  });

  it('rejects a downpayment above the price and an OA share outside 0 to 100%', () => {
    expect(codeFor(validateProjectionInput({ ...HDB_PURCHASE, downpayment: 60_000_000 }), 'downpayment')).toBe('exceeds-property-price');
    expect(codeFor(validateProjectionInput({ ...HDB_PURCHASE, downpaymentShareFromOrdinaryAccount: 1.1 }), 'downpaymentShareFromOrdinaryAccount')).toBe('above-maximum');
  });

  it('keeps tenure within the bounds for the kind of loan', () => {
    const hdbMax = INPUT_LIMITS.maximumTenureYears['hdb-concessionary'];
    const bankMax = INPUT_LIMITS.maximumTenureYears.bank;
    expect(validateProjectionInput({ ...HDB_PURCHASE, loanTenureYears: hdbMax }).ok).toBe(true);
    expect(errorsOf(validateProjectionInput({ ...HDB_PURCHASE, loanTenureYears: hdbMax + 1 }))).toEqual([
      expect.objectContaining({ field: 'loanTenureYears', code: 'above-maximum', limit: hdbMax }),
    ]);
    expect(validateProjectionInput({ ...BANK_PURCHASE, loanTenureYears: bankMax }).ok).toBe(true);
    expect(codeFor(validateProjectionInput({ ...BANK_PURCHASE, loanTenureYears: 0 }), 'loanTenureYears')).toBe('below-minimum');
  });

  it('needs no tenure or rate when the downpayment covers the whole price', () => {
    const cash = valid(
      validateProjectionInput({ ...BANK_PURCHASE, downpayment: 50_000_000, loanTenureYears: undefined, bankLoanRate: undefined }),
    );
    expect(cash.input.housing?.loan.principal).toBe(0);
  });

  it('clamps an HDB retention above the cap, and says so', () => {
    const cap = CURRENT_RULE_SET.housing.hdbLoanRetentionCap * 100;
    const result = valid(validateProjectionInput({ ...HDB_PURCHASE, ordinaryAccountRetention: 5_000_000 }));
    expect(result.input.housing?.ordinaryAccountRetention).toBe(cap);
    expect(result.adjustments).toEqual([
      expect.objectContaining({ field: 'ordinaryAccountRetention', code: 'clamped-to-maximum', from: 5_000_000, to: cap }),
    ]);
  });

  it('lets a bank-loan buyer retain any amount', () => {
    const result = valid(validateProjectionInput({ ...BANK_PURCHASE, ordinaryAccountRetention: 5_000_000 }));
    expect(result.input.housing?.ordinaryAccountRetention).toBe(5_000_000);
    expect(result.adjustments).toEqual([]);
  });
});

describe('the result the interface maps to fields', () => {
  it('reports every invalid field at once, one error each', () => {
    const result = validateProjectionInput({
      ...HDB_PURCHASE,
      currentAge: 12,
      monthlySalary: 10_000,
      purchaseAge: undefined,
      loanTenureYears: 40,
    });
    const fields = errorsOf(result).map((error) => error.field);
    expect(fields).toEqual(['currentAge', 'monthlySalary', 'purchaseAge', 'loanTenureYears']);
    expect(new Set(fields).size).toBe(fields.length);
    for (const error of errorsOf(result)) expect(error.message.length).toBeGreaterThan(10);
  });

  it('reports a malformed start month as an error rather than throwing', () => {
    expect(codeFor(validateProjectionInput({ ...NO_HOUSING, startMonth: '2026-13' }), 'startMonth')).toBe('invalid-month');
  });

  it('never throws, whatever it is given', () => {
    const awkward = [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1e15, 'text'] as unknown[];
    for (const value of awkward) {
      for (const field of ['currentAge', 'monthlySalary', 'salaryGrowthRate', 'propertyPrice', 'downpayment'] as const) {
        expect(() => validateProjectionInput({ ...HDB_PURCHASE, [field]: value as number })).not.toThrow();
      }
    }
  });
});

describe('projecting a draft', () => {
  it('returns the projection for a valid draft', () => {
    const outcome = projectDraft(HDB_PURCHASE);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result).toEqual(project(valid(validateProjectionInput(HDB_PURCHASE)).input));
  });

  it('returns errors instead of throwing for a draft the engine could not run', () => {
    // A wage this low would make the engine itself throw.
    const outcome = projectDraft({ ...NO_HOUSING, monthlySalary: 50_000 });
    expect(outcome).toEqual({ ok: false, errors: [expect.objectContaining({ field: 'monthlySalary' })] });
  });

  it('runs every valid draft without throwing, across ages, plans and edge values', () => {
    for (const currentAge of [16, 30, 54, 55, 64, 65, 70]) {
      for (const base of [NO_HOUSING, HDB_PURCHASE, BANK_PURCHASE]) {
        // Buy at 32, or now if older; never after the projection ends.
        const endAge = Math.max(INPUT_LIMITS.projectionEndAge, currentAge);
        const draft = { ...base, currentAge, purchaseAge: Math.min(Math.max(currentAge, 32), endAge) };
        const outcome = projectDraft(draft);
        expect(outcome.ok, `${base.housingPlan} at ${currentAge}`).toBe(true);
        if (outcome.ok) expect(outcome.result.months.length).toBeGreaterThan(0);
      }
    }
  });
});
