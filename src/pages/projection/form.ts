/**
 * The input panel's form state, and its translation to the engine's draft.
 *
 * The form holds values the way people type them: dollars, and percentages as
 * percentage points. The engine works in cents and fractions. Converting in one
 * pure function, here, keeps the components free of unit arithmetic and lets
 * the conversion be tested on its own.
 *
 * An empty field is `null`, a real state rather than zero: the validator then
 * reports it as required where it is required, and applies the stated default
 * where the spec makes the field optional.
 */

import type { MonthStamp } from '@/engine/types';
import type { FieldError, HousingPlanChoice, ProjectionDraft, ProjectionField } from '@/engine/validate';

const CENTS_PER_DOLLAR = 100;
const PERCENT = 100;

export interface FormValues {
  currentAge: number | null;
  /** Dollars a month. */
  monthlySalary: number | null;
  /** Percentage points a year: 3 is 3%. */
  salaryGrowthPercent: number | null;
  /** Dollars. Optional; empty means zero. */
  ordinaryBalance: number | null;
  specialBalance: number | null;
  medisaveBalance: number | null;
  housingPlan: HousingPlanChoice;
  /* Read only when a housing plan is selected. */
  propertyPrice: number | null;
  purchaseAge: number | null;
  /** Dollars: the whole downpayment. The loan is the price less this. */
  downpayment: number | null;
  /** Percentage points, 0 to 100, of the downpayment paid from the Ordinary Account. */
  ordinaryAccountSharePercent: number;
  loanTenureYears: number | null;
  /** Percentage points. Bank loans only. */
  bankLoanRatePercent: number | null;
}

export type FormField = keyof FormValues;

/**
 * The salary growth a visitor starts with: none. The salary is held flat at
 * today's figure, which makes no forecast; the hint says so, and the visitor
 * can enter their own expectation.
 */
export const DEFAULT_SALARY_GROWTH_PERCENT = 0;

/**
 * What a visitor lands on: illustrative values, not a typical member and not
 * a suggestion. No housing plan, so no particular purchase is put in front of
 * every visitor; the no-property projection is also the baseline any housing
 * scenario is compared against.
 */
export const DEFAULT_FORM: FormValues = {
  currentAge: 30,
  monthlySalary: 5_000,
  salaryGrowthPercent: DEFAULT_SALARY_GROWTH_PERCENT,
  ordinaryBalance: null,
  specialBalance: null,
  medisaveBalance: null,
  housingPlan: 'none',
  propertyPrice: null,
  purchaseAge: null,
  downpayment: null,
  ordinaryAccountSharePercent: 100,
  loanTenureYears: null,
  bankLoanRatePercent: null,
};

const cents = (dollars: number | null) => (dollars === null ? undefined : Math.round(dollars * CENTS_PER_DOLLAR));
const fraction = (percent: number | null) => (percent === null ? undefined : percent / PERCENT);
const optional = <T>(value: T | null) => (value === null ? undefined : value);

/** The form as the engine's draft: cents, fractions, and `undefined` for empty. */
export function toDraft(form: FormValues, startMonth: MonthStamp): ProjectionDraft {
  return {
    startMonth,
    currentAge: optional(form.currentAge),
    monthlySalary: cents(form.monthlySalary),
    salaryGrowthRate: fraction(form.salaryGrowthPercent),
    balances: {
      ordinary: cents(form.ordinaryBalance),
      special: cents(form.specialBalance),
      medisave: cents(form.medisaveBalance),
    },
    housingPlan: form.housingPlan,
    propertyPrice: cents(form.propertyPrice),
    purchaseAge: optional(form.purchaseAge),
    downpayment: cents(form.downpayment),
    downpaymentShareFromOrdinaryAccount: form.ordinaryAccountSharePercent / PERCENT,
    loanTenureYears: optional(form.loanTenureYears),
    bankLoanRate: fraction(form.bankLoanRatePercent),
  };
}

/** Which form field each of the validator's fields is shown against. */
const FORM_FIELD_FOR: Record<ProjectionField, FormField | undefined> = {
  // Supplied by the page, not the visitor; never shown against a field.
  startMonth: undefined,
  currentAge: 'currentAge',
  monthlySalary: 'monthlySalary',
  salaryGrowthRate: 'salaryGrowthPercent',
  // The raise month is not a v1 input; it always takes its default.
  salaryRaiseMonth: undefined,
  'balances.ordinary': 'ordinaryBalance',
  'balances.special': 'specialBalance',
  'balances.medisave': 'medisaveBalance',
  propertyPrice: 'propertyPrice',
  purchaseAge: 'purchaseAge',
  downpayment: 'downpayment',
  downpaymentShareFromOrdinaryAccount: 'ordinaryAccountSharePercent',
  loanTenureYears: 'loanTenureYears',
  bankLoanRate: 'bankLoanRatePercent',
  // Not a v1 input; the validator caps it rather than rejecting it.
  ordinaryAccountRetention: undefined,
};

export type FormErrors = Partial<Record<FormField, FieldError>>;

/** The validator's errors, keyed by the form field each belongs beside. */
export function errorsByField(errors: readonly FieldError[]): FormErrors {
  const byField: FormErrors = {};
  for (const error of errors) {
    const field = FORM_FIELD_FOR[error.field];
    if (field && !byField[field]) byField[field] = error;
  }
  return byField;
}

/**
 * Whether to show a field's error beside it yet.
 *
 * A wrong value is shown at once, so the visitor sees why the figures did not
 * update. A missing value is shown only once the visitor has been to the field
 * and left it, so a form they have not reached yet is not a wall of "required".
 */
export function shouldShowError(error: FieldError | undefined, touched: boolean): boolean {
  if (!error) return false;
  return error.code !== 'required' || touched;
}
