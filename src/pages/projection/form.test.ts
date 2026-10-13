import { describe, expect, it } from 'vitest';
import { projectDraft } from '@/engine/project';
import { validateProjectionInput, type FieldError, type ProjectionField } from '@/engine/validate';
import { DEFAULT_FORM, errorsByField, shouldShowError, toDraft, type FormValues } from './form';

const START = '2026-10';

describe('toDraft', () => {
  it('converts dollars to cents and percentage points to fractions', () => {
    const draft = toDraft(
      {
        ...DEFAULT_FORM,
        monthlySalary: 5_432.1,
        salaryGrowthPercent: 2.5,
        ordinaryBalance: 1_000,
        housingPlan: 'bank-loan',
        propertyPrice: 600_000,
        purchaseAge: 35,
        downpayment: 150_000,
        ordinaryAccountSharePercent: 40,
        loanTenureYears: 30,
        bankLoanRatePercent: 3.25,
      },
      START,
    );
    expect(draft).toMatchObject({
      startMonth: START,
      monthlySalary: 543_210,
      salaryGrowthRate: 0.025,
      balances: { ordinary: 100_000, special: undefined, medisave: undefined },
      propertyPrice: 60_000_000,
      downpayment: 15_000_000,
      downpaymentShareFromOrdinaryAccount: 0.4,
      loanTenureYears: 30,
      bankLoanRate: 0.0325,
    });
  });

  it('passes an empty field on as missing, not as zero', () => {
    const draft = toDraft({ ...DEFAULT_FORM, currentAge: null, monthlySalary: null }, START);
    expect(draft.currentAge).toBeUndefined();
    expect(draft.monthlySalary).toBeUndefined();
  });
});

describe('the default form', () => {
  it('projects at once, with flat salary growth and no housing plan', () => {
    expect(DEFAULT_FORM.salaryGrowthPercent).toBe(0);
    expect(DEFAULT_FORM.housingPlan).toBe('none');
    expect(projectDraft(toDraft(DEFAULT_FORM, START)).ok).toBe(true);
  });
});

describe('errors by field', () => {
  const error = (field: ProjectionField, code: FieldError['code'] = 'below-minimum'): FieldError => ({
    field,
    code,
    message: `${field} problem`,
  });

  it('puts each validator error against the form field that holds the value', () => {
    const byField = errorsByField([
      error('salaryGrowthRate'),
      error('balances.special'),
      error('downpaymentShareFromOrdinaryAccount'),
      error('bankLoanRate'),
    ]);
    expect(Object.keys(byField).sort()).toEqual(
      ['bankLoanRatePercent', 'ordinaryAccountSharePercent', 'salaryGrowthPercent', 'specialBalance'].sort(),
    );
  });

  it('maps every error the validator gives for a form-built draft to a visible field', () => {
    // A draft built from the form never trips a field the visitor cannot see.
    const broken: FormValues = {
      ...DEFAULT_FORM,
      currentAge: 12,
      monthlySalary: 100,
      salaryGrowthPercent: 50,
      ordinaryBalance: -1,
      housingPlan: 'bank-loan',
      propertyPrice: null,
      purchaseAge: 80,
      downpayment: null,
      loanTenureYears: 99,
      bankLoanRatePercent: null,
    };
    const result = validateProjectionInput(toDraft(broken, START));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const mapped = Object.values(errorsByField(result.errors));
    expect(mapped).toHaveLength(result.errors.length);
  });
});

describe('when to show an error', () => {
  const required: FieldError = { field: 'propertyPrice', code: 'required', message: 'needed' };
  const wrong: FieldError = { field: 'currentAge', code: 'above-maximum', message: 'too old' };

  it('shows a wrong value at once', () => {
    expect(shouldShowError(wrong, false)).toBe(true);
  });

  it('holds a missing value back until the field has been visited', () => {
    expect(shouldShowError(required, false)).toBe(false);
    expect(shouldShowError(required, true)).toBe(true);
  });

  it('shows nothing when there is no error', () => {
    expect(shouldShowError(undefined, true)).toBe(false);
  });
});
